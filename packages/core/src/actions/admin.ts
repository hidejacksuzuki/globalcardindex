"use server";

import { Prisma } from "@prisma/client";
import { prisma }  from "@gci/db";
import {
  computeTrustBreakdown,
  type TrustBreakdown,
} from "../engine/trustScore";
import {
  TRUST_THRESHOLD,
  computeRejectionReasons,
  type RejectionReason,
} from "./_helpers";

// ----------------------------------------------------------------
// getRecalcLogs  (/admin/logs)
// ----------------------------------------------------------------

export type RecalcLogEntry = {
  id:            string;
  status:        "success" | "no_data" | "error";
  triggeredBy:   string;
  durationMs:    number | null;
  value:         number | null;
  changeRate:    number | null;
  sampleCount:   number | null;
  outlierCount:  number | null;
  staleFlagged:  number | null;
  staleUnflagged: number | null;
  errorMessage:  string | null;
  createdAt:     Date;
};

export async function getRecalcLogs(limit = 50): Promise<RecalcLogEntry[]> {
  const rows = await prisma.recalcLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    limit,
  });
  return rows.map((r) => ({
    id:             r.id,
    status:         r.status as RecalcLogEntry["status"],
    triggeredBy:    r.triggeredBy,
    durationMs:     r.durationMs,
    value:          r.value,
    changeRate:     r.changeRate,
    sampleCount:    r.sampleCount,
    outlierCount:   r.outlierCount,
    staleFlagged:   r.staleFlagged,
    staleUnflagged: r.staleUnflagged,
    errorMessage:   r.errorMessage,
    createdAt:      r.createdAt,
  }));
}


// ----------------------------------------------------------------
// getPriceStats  (/admin/prices サマリー)
// ----------------------------------------------------------------

export type PriceStats = {
  total:         number;
  active:        number;
  stale:         number;
  outlier:       number;
  lowTrust:      number;
  avgTrustScore: number | null;
  bySources: {
    sourceName:     string;
    sourceType:     string | null;
    total:          number;
    active:         number;
    stale:          number;
    outlier:        number;
    avgTrust:       number;
    trustWeight:    number;
    lastCapturedAt: Date | null;
  }[];
  staleCards: {
    cardId:         string;
    cardName:       string;
    setName:        string;
    lastCapturedAt: Date | null;
    priceCount:     number;
  }[];
  recentOutliers: {
    id:         string;
    cardName:   string;
    setName:    string;
    price:      number;
    currency:   string;
    sourceName: string;
    trustScore: number;
    observedAt: Date;
  }[];
};

export async function getPriceStats(): Promise<PriceStats> {
  const [
    total, active, stale, outlier, lowTrust,
    avgTrustRaw, sourceGroups, staleGroups, recentOutliersRaw,
  ] = await Promise.all([
    prisma.price.count(),
    prisma.price.count({
      where: { isOutlier: false, isStale: false, trustScore: { gte: TRUST_THRESHOLD } },
    }),
    prisma.price.count({ where: { isStale:   true } }),
    prisma.price.count({ where: { isOutlier: true } }),
    prisma.price.count({ where: { trustScore: { lt: TRUST_THRESHOLD } } }),
    prisma.price.aggregate({ _avg: { trustScore: true } }),
    prisma.price.groupBy({
      by: ["sourceName", "sourceType"],
      _count: { id: true }, _avg: { trustScore: true }, _max: { capturedAt: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.price.groupBy({
      by: ["cardId"], where: { isStale: true },
      _max: { capturedAt: true }, _count: { id: true },
      orderBy: { _max: { capturedAt: "asc" } }, take: 20,
    }),
    prisma.price.findMany({
      where: { isOutlier: true }, orderBy: { observedAt: "desc" }, take: 20,
      include: { card: { select: { name: true, setName: true } } },
    }),
  ]);

  const sourceRecords = await prisma.source.findMany({
    select: { name: true, trustWeight: true },
  });
  const trustWeightMap = Object.fromEntries(
    sourceRecords.map((s) => [s.name, s.trustWeight]),
  );

  const [sourceActiveMap, sourceStaleMap, sourceOutlierMap] = await Promise.all([
    prisma.price.groupBy({
      by: ["sourceName"],
      where: { isOutlier: false, isStale: false, trustScore: { gte: TRUST_THRESHOLD } },
      _count: { id: true },
    }),
    prisma.price.groupBy({ by: ["sourceName"], where: { isStale:   true }, _count: { id: true } }),
    prisma.price.groupBy({ by: ["sourceName"], where: { isOutlier: true }, _count: { id: true } }),
  ]);

  const toMap = (rows: { sourceName: string; _count: { id: number } }[]) =>
    Object.fromEntries(rows.map((r) => [r.sourceName, r._count.id]));

  const activeMap  = toMap(sourceActiveMap);
  const staleMap   = toMap(sourceStaleMap);
  const outlierMap = toMap(sourceOutlierMap);

  const staleCardIds  = staleGroups.map((g) => g.cardId);
  const staleCardInfo = staleCardIds.length > 0
    ? await prisma.card.findMany({
        where: { id: { in: staleCardIds } },
        select: { id: true, name: true, setName: true },
      })
    : [];
  const cardInfoMap = Object.fromEntries(staleCardInfo.map((c) => [c.id, c]));

  return {
    total, active, stale, outlier, lowTrust,
    avgTrustScore: avgTrustRaw._avg.trustScore,
    bySources: sourceGroups.map((g) => ({
      sourceName:     g.sourceName,
      sourceType:     g.sourceType ?? null,
      total:          g._count.id,
      active:         activeMap[g.sourceName]  ?? 0,
      stale:          staleMap[g.sourceName]   ?? 0,
      outlier:        outlierMap[g.sourceName] ?? 0,
      avgTrust:       Math.round(g._avg.trustScore ?? 0),
      trustWeight:    trustWeightMap[g.sourceName] ?? 1.0,
      lastCapturedAt: g._max.capturedAt           ?? null,
    })),
    staleCards: staleGroups.map((g) => ({
      cardId:         g.cardId,
      cardName:       cardInfoMap[g.cardId]?.name    ?? "(unknown)",
      setName:        cardInfoMap[g.cardId]?.setName ?? "",
      lastCapturedAt: g._max.capturedAt              ?? null,
      priceCount:     g._count.id,
    })),
    recentOutliers: recentOutliersRaw.map((p) => ({
      id:         p.id,
      cardName:   p.card.name,
      setName:    p.card.setName,
      price:      p.price,
      currency:   p.currency,
      sourceName: p.sourceName,
      trustScore: p.trustScore,
      observedAt: p.observedAt,
    })),
  };
}

// ----------------------------------------------------------------
// getPriceList  (/admin/prices 明細・採用除外理由 + trust breakdown)
// ----------------------------------------------------------------

export type PriceListFilter =
  | "all" | "included" | "excluded" | "outlier" | "stale" | "low_trust";

export type PriceRow = {
  id:               string;
  cardName:         string;
  setName:          string;
  price:            number;
  currency:         string;
  trustScore:       number;
  trustBreakdown:   TrustBreakdown;
  sourceName:       string;
  listingType:      string | null;
  sellerScore:      number | null;
  isOutlier:        boolean;
  isStale:          boolean;
  fingerprint:      string | null;
  capturedAt:       Date;
  includedInIndex:  boolean;
  rejectionReasons: RejectionReason[];
};

export async function getPriceList({
  page   = 1,
  filter = "all",
  limit  = 50,
}: {
  page?:   number;
  filter?: PriceListFilter;
  limit?:  number;
} = {}): Promise<{
  rows: PriceRow[]; total: number; page: number; totalPages: number;
}> {
  let where: Prisma.PriceWhereInput = {};
  switch (filter) {
    case "included":  where = { isOutlier: false, isStale: false, trustScore: { gte: TRUST_THRESHOLD } }; break;
    case "excluded":  where = { OR: [{ isOutlier: true }, { isStale: true }, { trustScore: { lt: TRUST_THRESHOLD } }] }; break;
    case "outlier":   where = { isOutlier: true }; break;
    case "stale":     where = { isStale:   true }; break;
    case "low_trust": where = { trustScore: { lt: TRUST_THRESHOLD } }; break;
  }

  const [total, raw, sourceRecords] = await Promise.all([
    prisma.price.count({ where }),
    prisma.price.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
      include: { card: { select: { name: true, setName: true } } },
    }),
    // breakdown 計算用に Source の defaultTrustScore / trustWeight を取得
    prisma.source.findMany({
      select: { name: true, defaultTrustScore: true, trustWeight: true },
    }),
  ]);

  const sourceMap = Object.fromEntries(
    sourceRecords.map((s) => [s.name, s]),
  );

  const rows: PriceRow[] = raw.map((p) => {
    const src  = sourceMap[p.sourceName];
    const breakdown = computeTrustBreakdown({
      sourceDefaultScore: src?.defaultTrustScore ?? 50,
      sourceTrustWeight:  src?.trustWeight       ?? 1.0,
      sellerScore:        p.sellerScore,
      listingType:        p.listingType,
    });
    const rejectionReasons = computeRejectionReasons(p);
    return {
      id:               p.id,
      cardName:         p.card.name,
      setName:          p.card.setName,
      price:            p.price,
      currency:         p.currency,
      trustScore:       p.trustScore,
      trustBreakdown:   breakdown,
      sourceName:       p.sourceName,
      listingType:      p.listingType,
      sellerScore:      p.sellerScore,
      isOutlier:        p.isOutlier,
      isStale:          p.isStale,
      fingerprint:      p.fingerprint,
      capturedAt:       p.capturedAt,
      includedInIndex:  rejectionReasons.length === 0,
      rejectionReasons,
    };
  });

  return { rows, total, page, totalPages: Math.ceil(total / limit) };
}

// ----------------------------------------------------------------
// getSourceStats  (/admin/sources 集計)
// ----------------------------------------------------------------

export type SourceStat = {
  sourceName:     string;
  sourceType:     string | null;
  total:          number;
  active:         number;
  stale:          number;
  outlier:        number;
  lowTrust:       number;
  staleRate:      number;
  outlierRate:    number;
  avgTrust:       number;
  trustWeight:    number;
  lastCapturedAt: Date | null;
};

export async function getSourceStats(): Promise<SourceStat[]> {
  const [
    sourceGroups, sourceActiveRaw, sourceStaleRaw,
    sourceOutlierRaw, sourceLowTrustRaw, sourceRecords,
  ] = await Promise.all([
    prisma.price.groupBy({
      by: ["sourceName", "sourceType"],
      _count: { id: true }, _avg: { trustScore: true }, _max: { capturedAt: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.price.groupBy({
      by: ["sourceName"],
      where: { isOutlier: false, isStale: false, trustScore: { gte: TRUST_THRESHOLD } },
      _count: { id: true },
    }),
    prisma.price.groupBy({ by: ["sourceName"], where: { isStale: true }, _count: { id: true } }),
    prisma.price.groupBy({ by: ["sourceName"], where: { isOutlier: true }, _count: { id: true } }),
    prisma.price.groupBy({ by: ["sourceName"], where: { trustScore: { lt: TRUST_THRESHOLD } }, _count: { id: true } }),
    prisma.source.findMany({ select: { name: true, trustWeight: true } }),
  ]);

  const toMap = (rows: { sourceName: string; _count: { id: number } }[]) =>
    Object.fromEntries(rows.map((r) => [r.sourceName, r._count.id]));

  const activeMap   = toMap(sourceActiveRaw);
  const staleMap    = toMap(sourceStaleRaw);
  const outlierMap  = toMap(sourceOutlierRaw);
  const lowTrustMap = toMap(sourceLowTrustRaw);
  const weightMap   = Object.fromEntries(sourceRecords.map((s) => [s.name, s.trustWeight]));

  return sourceGroups.map((g) => {
    const total   = g._count.id;
    const stale   = staleMap[g.sourceName]   ?? 0;
    const outlier = outlierMap[g.sourceName] ?? 0;
    return {
      sourceName:     g.sourceName,
      sourceType:     g.sourceType ?? null,
      total,
      active:         activeMap[g.sourceName]   ?? 0,
      stale,
      outlier,
      lowTrust:       lowTrustMap[g.sourceName] ?? 0,
      staleRate:      total > 0 ? (stale   / total) * 100 : 0,
      outlierRate:    total > 0 ? (outlier / total) * 100 : 0,
      avgTrust:       Math.round(g._avg.trustScore ?? 0),
      trustWeight:    weightMap[g.sourceName]   ?? 1.0,
      lastCapturedAt: g._max.capturedAt         ?? null,
    };
  });
}

// ----------------------------------------------------------------
// getSourceTrends  (source health trend: 24h / 7d / 30d)
// ----------------------------------------------------------------

export type SourceWindow = {
  count:       number;  // その期間内の price 件数
  staleCount:  number;
  outlierCount: number;
  staleRate:   number;  // 0-100
  outlierRate: number;
};

export type SourceTrend = {
  sourceName:     string;
  sourceType:     string | null;
  lastCapturedAt: Date | null;
  h24:  SourceWindow;
  d7:   SourceWindow;
  d30:  SourceWindow;
  /** fetch が止まっている可能性 */
  status: "healthy" | "degraded" | "dead";
};

export async function getSourceTrends(): Promise<SourceTrend[]> {
  const now = new Date();
  const cutH24 = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000);
  const cutD7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const cutD30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // source 一覧（ベース）
  const sourceGroups = await prisma.price.groupBy({
    by:      ["sourceName", "sourceType"],
    _max:    { capturedAt: true },
    orderBy: { _max: { capturedAt: "desc" } },
  });

  // 各ウィンドウの count / staleCount / outlierCount を並列取得
  const makeWindowQueries = (gte: Date) => [
    prisma.price.groupBy({ by: ["sourceName"], where: { capturedAt: { gte } },                         _count: { id: true } }),
    prisma.price.groupBy({ by: ["sourceName"], where: { capturedAt: { gte }, isStale:   true },         _count: { id: true } }),
    prisma.price.groupBy({ by: ["sourceName"], where: { capturedAt: { gte }, isOutlier: true },         _count: { id: true } }),
  ] as const;

  const [
    [cnt24, stale24, outlier24],
    [cnt7,  stale7,  outlier7],
    [cnt30, stale30, outlier30],
  ] = await Promise.all([
    Promise.all(makeWindowQueries(cutH24)),
    Promise.all(makeWindowQueries(cutD7)),
    Promise.all(makeWindowQueries(cutD30)),
  ]);

  const toMap = (rows: { sourceName: string; _count: { id: number } }[]) =>
    Object.fromEntries(rows.map((r) => [r.sourceName, r._count.id]));

  const maps = {
    cnt24: toMap(cnt24), stale24: toMap(stale24), outlier24: toMap(outlier24),
    cnt7:  toMap(cnt7),  stale7:  toMap(stale7),  outlier7:  toMap(outlier7),
    cnt30: toMap(cnt30), stale30: toMap(stale30),  outlier30: toMap(outlier30),
  };

  const makeWindow = (
    name: string,
    cntMap: Record<string, number>,
    staleMap: Record<string, number>,
    outlierMap: Record<string, number>,
  ): SourceWindow => {
    const count        = cntMap[name]     ?? 0;
    const staleCount   = staleMap[name]   ?? 0;
    const outlierCount = outlierMap[name] ?? 0;
    return {
      count,
      staleCount,
      outlierCount,
      staleRate:   count > 0 ? (staleCount   / count) * 100 : 0,
      outlierRate: count > 0 ? (outlierCount / count) * 100 : 0,
    };
  };

  return sourceGroups.map((g) => {
    const h24 = makeWindow(g.sourceName, maps.cnt24, maps.stale24, maps.outlier24);
    const d7  = makeWindow(g.sourceName, maps.cnt7,  maps.stale7,  maps.outlier7);
    const d30 = makeWindow(g.sourceName, maps.cnt30, maps.stale30, maps.outlier30);

    const status: SourceTrend["status"] =
      h24.count > 0 ? "healthy"
      : d7.count > 0 ? "degraded"
      : "dead";

    return {
      sourceName:     g.sourceName,
      sourceType:     g.sourceType     ?? null,
      lastCapturedAt: g._max.capturedAt ?? null,
      h24, d7, d30,
      status,
    };
  });
}

// ----------------------------------------------------------------
// getIndexList  (/admin/index トップ)
// ----------------------------------------------------------------

export type IndexListItem = {
  id:           string;
  value:        number;
  changeRate:   number;
  calculatedAt: Date;
};

export async function getIndexList(limit = 20): Promise<IndexListItem[]> {
  const rows = await prisma.indexValue.findMany({
    where:   { cardId: null },
    orderBy: { calculatedAt: "desc" },
    take:    limit,
  });
  return rows.map((r) => ({
    id:           r.id,
    value:        r.value,
    changeRate:   r.changeRate,
    calculatedAt: r.calculatedAt,
  }));
}

// ----------------------------------------------------------------
// getIndexComposition  (/admin/index/[slug])
//
// IndexValue は採用価格を保存していないため、
// 「現時点でのクリーン価格プール」をカード別に集計して返す。
// ================================================================
export type CompositionCard = {
  cardId:    string;
  cardName:  string;
  setName:   string;
  priceCount: number;
  avgPrice:   number;
  minPrice:   number;
  maxPrice:   number;
  avgTrust:   number;
  currency:   string;
};

export type IndexComposition = {
  indexValue:    IndexListItem;
  totalPrices:   number;
  totalCards:    number;
  cards:         CompositionCard[];
  /** 現時点の再現値（参考） */
  recomputedAvg: number | null;
};

export async function getIndexComposition(id: string): Promise<IndexComposition | null> {
  const indexValue = await prisma.indexValue.findUnique({ where: { id } });
  if (!indexValue) return null;

  // その IndexValue の calculatedAt 時点より前に capturedAt された clean prices
  // ※ isStale/isOutlier は現在フラグのため近似値。
  const cleanPrices = await prisma.price.findMany({
    where: {
      isOutlier:   false,
      isStale:     false,
      trustScore:  { gte: TRUST_THRESHOLD },
      capturedAt:  { lte: indexValue.calculatedAt },
    },
    include: { card: { select: { name: true, setName: true } } },
    orderBy: { capturedAt: "desc" },
  });

  // カード別集計
  type CardAgg = {
    prices:    number[];
    trusts:    number[];
    cardName:  string;
    setName:   string;
    currency:  string;
  };
  const byCard = new Map<string, CardAgg>();

  for (const p of cleanPrices) {
    const existing = byCard.get(p.cardId);
    if (existing) {
      existing.prices.push(p.price);
      existing.trusts.push(p.trustScore);
    } else {
      byCard.set(p.cardId, {
        prices:   [p.price],
        trusts:   [p.trustScore],
        cardName: p.card.name,
        setName:  p.card.setName,
        currency: p.currency,
      });
    }
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const cards: CompositionCard[] = Array.from(byCard.entries())
    .map(([cardId, agg]) => ({
      cardId,
      cardName:   agg.cardName,
      setName:    agg.setName,
      priceCount: agg.prices.length,
      avgPrice:   avg(agg.prices),
      minPrice:   Math.min(...agg.prices),
      maxPrice:   Math.max(...agg.prices),
      avgTrust:   Math.round(avg(agg.trusts)),
      currency:   agg.currency,
    }))
    .sort((a, b) => b.avgPrice - a.avgPrice);

  const recomputedAvg =
    cleanPrices.length > 0
      ? cleanPrices.reduce((sum, p) => sum + p.price, 0) / cleanPrices.length
      : null;

  return {
    indexValue: {
      id:           indexValue.id,
      value:        indexValue.value,
      changeRate:   indexValue.changeRate,
      calculatedAt: indexValue.calculatedAt,
    },
    totalPrices:   cleanPrices.length,
    totalCards:    byCard.size,
    cards,
    recomputedAvg,
  };
}
