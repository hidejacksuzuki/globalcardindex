import { prisma } from "@gci/db";

export const INDEX_BASE_VALUE    = 1000;
export const TRIM_RATIO          = 0.05;
export const DEFAULT_WINDOW_DAYS = 30;

// Minimum samples to compute a meaningful index
export const MIN_SAMPLES_COMPUTE  = 3;
// Minimum samples to display index to public (suppressed below this)
export const MIN_SAMPLES_DISPLAY  = 3;

// ----------------------------------------------------------------
// Condition-based weight map
// Higher condition → more weight (NM is canonical; damaged dilutes)
// ----------------------------------------------------------------
export const CONDITION_WEIGHTS: Record<string, number> = {
  NM:  1.0,
  LP:  0.95,
  MP:  0.85,
  HP:  0.70,
  DMG: 0.55,
};

export type PriceLike = {
  price:      number;
  trustScore: number;
  condition?: string | null;
};

// ----------------------------------------------------------------
// Confidence tier
// Based on sample count and outlier rate after IQR removal.
// ----------------------------------------------------------------
export type ConfidenceTier = "HIGH" | "MED" | "LOW";

export function computeConfidence(
  sampleCount:  number,
  outlierCount: number,
): ConfidenceTier {
  const outlierRate = sampleCount > 0 ? outlierCount / (sampleCount + outlierCount) : 0;

  if (sampleCount >= 10 && outlierRate < 0.20) return "HIGH";
  if (sampleCount >= MIN_SAMPLES_COMPUTE && outlierRate < 0.40) return "MED";
  return "LOW";
}

// ----------------------------------------------------------------
// IQR-based outlier detection
// Tukey fences: Q1 – k*IQR ~ Q3 + k*IQR (k = 1.5)
// ----------------------------------------------------------------
export const IQR_FENCE = 1.5;

export function detectOutliers(prices: PriceLike[]): {
  clean:    PriceLike[];
  outliers: PriceLike[];
} {
  if (prices.length < 4) {
    return { clean: prices, outliers: [] };
  }

  const sorted = [...prices].sort((a, b) => a.price - b.price);
  const n  = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)].price;
  const q3 = sorted[Math.floor(n * 0.75)].price;
  const iqr = q3 - q1;

  const lower = q1 - IQR_FENCE * iqr;
  const upper = q3 + IQR_FENCE * iqr;

  const clean:    PriceLike[] = [];
  const outliers: PriceLike[] = [];

  for (const p of prices) {
    if (p.price >= lower && p.price <= upper) {
      clean.push(p);
    } else {
      outliers.push(p);
    }
  }

  return clean.length > 0 ? { clean, outliers } : { clean: prices, outliers: [] };
}

// ----------------------------------------------------------------
// aggregatePrices
// 1. IQR outlier rejection
// 2. Trim 5% tails
// 3. trustScore × condition-weight weighted average
// ----------------------------------------------------------------
export function aggregatePrices(prices: PriceLike[]): number | null {
  if (prices.length === 0) return null;

  // Step 1: IQR outlier removal
  const { clean } = detectOutliers(prices);

  // Step 2: trim tails
  const sorted  = [...clean].sort((a, b) => a.price - b.price);
  const trim    = Math.floor(sorted.length * TRIM_RATIO);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  const used    = trimmed.length > 0 ? trimmed : sorted;

  // Step 3: trustScore × conditionWeight weighted average
  let totalWeight  = 0;
  let weightedSum  = 0;

  for (const p of used) {
    const condWeight = CONDITION_WEIGHTS[p.condition ?? ""] ?? 1.0;
    const weight     = Math.max(p.trustScore, 1) * condWeight;
    totalWeight  += weight;
    weightedSum  += p.price * weight;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

// ----------------------------------------------------------------
// calculateIndex — global GCI index (all cards combined)
// Preserved for backward compatibility with existing cron jobs.
// ----------------------------------------------------------------
export type CalculateIndexResult = {
  value:        number;
  changeRate:   number;
  sampleCount:  number;
  outlierCount: number;
  confidence:   ConfidenceTier;
};

export async function calculateIndex(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<CalculateIndexResult | null> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const since    = new Date(Date.now() - windowMs);

  const currentPrices = await prisma.price.findMany({
    where: {
      observedAt: { gte: since },
      isOutlier:  false,
      isStale:    false,
    },
    select: { price: true, trustScore: true, card: { select: { condition: true } } },
  });

  const outlierCount = await prisma.price.count({
    where: { observedAt: { gte: since }, isOutlier: true },
  });

  // Flatten to PriceLike
  const flat: PriceLike[] = currentPrices.map((p) => ({
    price:      p.price,
    trustScore: p.trustScore,
    condition:  p.card.condition,
  }));

  const currentAgg = aggregatePrices(flat);
  if (currentAgg === null) return null;

  // Base value
  let value = INDEX_BASE_VALUE;
  const earliest = await prisma.price.findFirst({
    where:   { isOutlier: false, isStale: false },
    orderBy: { observedAt: "asc" },
    select:  { observedAt: true },
  });

  if (earliest) {
    const baseEnd    = new Date(earliest.observedAt.getTime() + windowMs);
    const basePrices = await prisma.price.findMany({
      where: {
        observedAt: { gte: earliest.observedAt, lte: baseEnd },
        isOutlier:  false,
        isStale:    false,
      },
      select: { price: true, trustScore: true, card: { select: { condition: true } } },
    });
    const baseFlat: PriceLike[] = basePrices.map((p) => ({
      price:      p.price,
      trustScore: p.trustScore,
      condition:  p.card.condition,
    }));
    const baseAgg = aggregatePrices(baseFlat);
    if (baseAgg && baseAgg > 0) {
      value = (currentAgg / baseAgg) * INDEX_BASE_VALUE;
    }
  }

  const previous = await prisma.indexValue.findFirst({
    where:   { cardId: null },
    orderBy: { calculatedAt: "desc" },
    select:  { value: true },
  });

  const changeRate =
    previous && previous.value !== 0
      ? ((value - previous.value) / previous.value) * 100
      : 0;

  return {
    value,
    changeRate,
    sampleCount:  flat.length,
    outlierCount,
    confidence:   computeConfidence(flat.length, outlierCount),
  };
}

// ----------------------------------------------------------------
// calculateCardIndex — per-card index
// Week 18: computes an index value relative to the card's own
// historical average (base = first 30-day window for this card).
// Falls back to a raw average (as "absolute" yen) when no history.
// ----------------------------------------------------------------
export type CardIndexResult = {
  cardId:       string;
  value:        number;       // index value (or average price if no history)
  changeRate:   number;       // % change from previous index value
  sampleCount:  number;       // clean prices used
  outlierCount: number;       // prices flagged as outlier
  confidence:   ConfidenceTier;
  averagePrice: number;       // raw weighted average ¥ (always present)
};

export async function calculateCardIndex(
  cardId:     string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<CardIndexResult | null> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const since    = new Date(Date.now() - windowMs);

  // Current window prices for this card
  const currentPrices = await prisma.price.findMany({
    where: {
      cardId,
      observedAt: { gte: since },
      isOutlier:  false,
      isStale:    false,
    },
    select: { price: true, trustScore: true },
    orderBy: { observedAt: "desc" },
  });

  // Outlier count (for confidence)
  const outlierCount = await prisma.price.count({
    where: { cardId, observedAt: { gte: since }, isOutlier: true },
  });

  if (currentPrices.length < MIN_SAMPLES_COMPUTE) return null;

  const flat: PriceLike[] = currentPrices.map((p) => ({
    price:      p.price,
    trustScore: p.trustScore,
  }));

  const currentAgg = aggregatePrices(flat);
  if (currentAgg === null) return null;

  // Base period: earliest 30-day window for this card
  let value = INDEX_BASE_VALUE;
  const earliest = await prisma.price.findFirst({
    where:   { cardId, isOutlier: false, isStale: false },
    orderBy: { observedAt: "asc" },
    select:  { observedAt: true },
  });

  if (earliest) {
    const baseEnd    = new Date(earliest.observedAt.getTime() + windowMs);
    const basePrices = await prisma.price.findMany({
      where: {
        cardId,
        observedAt: { gte: earliest.observedAt, lte: baseEnd },
        isOutlier:  false,
        isStale:    false,
      },
      select: { price: true, trustScore: true },
    });
    if (basePrices.length >= MIN_SAMPLES_COMPUTE) {
      const baseFlat: PriceLike[] = basePrices.map((p) => ({
        price:      p.price,
        trustScore: p.trustScore,
      }));
      const baseAgg = aggregatePrices(baseFlat);
      if (baseAgg && baseAgg > 0) {
        value = (currentAgg / baseAgg) * INDEX_BASE_VALUE;
      }
    }
  }

  // Previous card index for changeRate
  const previous = await prisma.indexValue.findFirst({
    where:   { cardId },
    orderBy: { calculatedAt: "desc" },
    select:  { value: true },
  });

  const changeRate =
    previous && previous.value !== 0
      ? ((value - previous.value) / previous.value) * 100
      : 0;

  return {
    cardId,
    value,
    changeRate,
    sampleCount:  flat.length,
    outlierCount,
    confidence:   computeConfidence(flat.length, outlierCount),
    averagePrice: currentAgg,
  };
}
