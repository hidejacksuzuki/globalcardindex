import { prisma } from "@/lib/prisma";

export const INDEX_BASE_VALUE   = 1000;
export const TRIM_RATIO         = 0.05;
export const DEFAULT_WINDOW_DAYS = 30;

export type PriceLike = {
  price:      number;
  trustScore: number;
};

// ----------------------------------------------------------------
// IQR ベースの外れ値検出
//
// Q1 – k*IQR ～ Q3 + k*IQR の範囲外を外れ値とみなす。
// k = 1.5 が一般的（Tukey fences）。
// ----------------------------------------------------------------
export const IQR_FENCE = 1.5;

export function detectOutliers(prices: PriceLike[]): {
  clean:    PriceLike[];
  outliers: PriceLike[];
} {
  if (prices.length < 4) {
    // サンプルが少なすぎる場合は外れ値除去しない
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

  // 全部外れ値になってしまった場合は元データを返す（安全策）
  return clean.length > 0 ? { clean, outliers } : { clean: prices, outliers: [] };
}

// ----------------------------------------------------------------
// aggregatePrices
// Week 3 変更:
//   1. IQR outlier rejection を先に適用
//   2. さらに trim 5% で裾を落とす
//   3. trustScore 加重平均
//   4. isOutlier=true のレコードは DB 側でも除外済み（where に追加）
// ----------------------------------------------------------------
export function aggregatePrices(prices: PriceLike[]): number | null {
  if (prices.length === 0) return null;

  // Step 1: IQR による外れ値除去
  const { clean } = detectOutliers(prices);

  // Step 2: 上下 5% をトリム
  const sorted = [...clean].sort((a, b) => a.price - b.price);
  const trim   = Math.floor(sorted.length * TRIM_RATIO);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  const used    = trimmed.length > 0 ? trimmed : sorted;

  // Step 3: trustScore 加重平均
  const totalWeight = used.reduce((sum, p) => sum + Math.max(p.trustScore, 1), 0);
  if (totalWeight === 0) return null;

  const weightedSum = used.reduce(
    (sum, p) => sum + p.price * Math.max(p.trustScore, 1),
    0,
  );

  return weightedSum / totalWeight;
}

// ----------------------------------------------------------------
// calculateIndex
// Week 3 変更: isOutlier=false / isStale=false のレコードのみ採用
// ----------------------------------------------------------------
export type CalculateIndexResult = {
  value:        number;
  changeRate:   number;
  sampleCount:  number;
  outlierCount: number; // 除外された外れ値の数（ログ用）
};

export async function calculateIndex(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<CalculateIndexResult | null> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const since    = new Date(Date.now() - windowMs);

  // isOutlier / isStale を除いた信頼できる価格だけ取得
  const currentPrices = await prisma.price.findMany({
    where: {
      observedAt: { gte: since },
      isOutlier:  false,
      isStale:    false,
    },
    select: { price: true, trustScore: true },
  });

  // outlier 件数をログ用に別途カウント
  const outlierCount = await prisma.price.count({
    where: { observedAt: { gte: since }, isOutlier: true },
  });

  const currentAgg = aggregatePrices(currentPrices);
  if (currentAgg === null) return null;

  // ── 基準値（最初の windowDays 期間）の集計 ──
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
      select: { price: true, trustScore: true },
    });
    const baseAgg = aggregatePrices(basePrices);
    if (baseAgg && baseAgg > 0) {
      value = (currentAgg / baseAgg) * INDEX_BASE_VALUE;
    }
  }

  // ── 前回比 ──
  const previous = await prisma.indexValue.findFirst({
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
    sampleCount:  currentPrices.length,
    outlierCount,
  };
}
