"use server";

import { prisma }          from "@gci/db";
import {
  aggregatePrices,
  DEFAULT_WINDOW_DAYS,
} from "../engine/indexCalculator";
import { buildCardSearchWhere, TRUST_THRESHOLD } from "./_helpers";
import type {
  MarketboardRow,
  MarketSortKey,
  MarketSortOrder,
} from "../types";

export type GetMarketboardOptions = {
  search?: string;
  windowDays?: number;
  sort?: MarketSortKey | null;
  order?: MarketSortOrder;
};

export async function getMarketboard(
  opts: GetMarketboardOptions = {},
): Promise<MarketboardRow[]> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const cards = await prisma.card.findMany({
    where: buildCardSearchWhere(opts.search),
    include: {
      prices: { orderBy: { observedAt: "desc" }, take: 200 },
    },
  });

  // Week 19: join per-card IndexValues in one batch query
  const cardIds = cards.map((c) => c.id);
  const indexRows = await prisma.indexValue.findMany({
    where:   { cardId: { in: cardIds } },
    orderBy: { calculatedAt: "desc" },
    select: {
      cardId:      true,
      value:       true,
      changeRate:  true,
      sampleCount: true,
      confidence:  true,
    },
  });
  // Keep latest per card
  const indexMap = new Map<string, typeof indexRows[0]>();
  for (const r of indexRows) {
    if (r.cardId && !indexMap.has(r.cardId)) indexMap.set(r.cardId, r);
  }

  const rows: MarketboardRow[] = cards.map((card) => {
    const dataPoints = card.prices.length;
    const latest = card.prices[0] ?? null;
    const windowPrices = card.prices.filter((p) => p.observedAt >= since);
    const baseline =
      windowPrices.length > 0
        ? aggregatePrices(
            windowPrices.map((p) => ({
              price: p.price,
              trustScore: p.trustScore,
            })),
          )
        : null;

    const changeRate =
      latest && baseline && baseline !== 0
        ? ((latest.price - baseline) / baseline) * 100
        : null;

    const idx = indexMap.get(card.id);

    return {
      cardId: card.id,
      name: card.name,
      setName: card.setName,
      rarity: card.rarity,
      condition: card.condition,
      latestPrice: latest ? latest.price : null,
      currency: latest ? latest.currency : null,
      changeRate,
      dataPoints,
      lastObservedAt: latest ? latest.observedAt.toISOString() : null,
      // Week 19: index quality fields
      indexValue:  idx?.value       ?? null,
      indexChange: idx?.changeRate  ?? null,
      sampleCount: idx?.sampleCount ?? null,
      confidence:  idx?.confidence  ?? null,
    };
  });

  return sortRows(rows, opts.sort ?? null, opts.order ?? "desc");
}

// ================================================================
// Week 6: Trending / Gainers / Losers / Volume Spikes
// ================================================================

/**
 * クエリ戦略: 4バルククエリ（カード数に依存しない O(1) クエリ数）
 *   Q1: 候補 cardId 一覧   (groupBy + having)
 *   Q2: 直近8日の価格      (最新価格・24h/7d volume 集計用)
 *   Q3: 7日前以前の価格    (change7d 分母)
 *   Q4: カードメタデータ
 */

const MIN_OBS_7D      = 5;    // 候補とする最低 7d 観測数
const CANDIDATE_LIMIT = 300;  // 最大候補数

export type MarketCard = {
  cardId:      string;
  slug:        string | null;
  cardName:    string;
  setName:     string;
  game:        string | null;
  rarity:      string;
  condition:   string;
  latestPrice: number | null;
  currency:    string | null;
  change7d:    number | null;   // % (null = ベースラインなし)
  change7dAbs: number | null;
  count24h:    number;
  count7d:     number;
  avgTrust:    number;
  trendScore:  number;
};

// trendScore = max(change7d,0)×0.5 + log1p(count24h)×2 + (avgTrust/100)×5
function computeTrendScore(change7d: number | null, count24h: number, avgTrust: number): number {
  return (
    (change7d !== null ? Math.max(0, change7d) * 0.5 : 0) +
    Math.log1p(count24h) * 2.0 +
    (avgTrust / 100) * 5
  );
}

async function fetchCandidates(): Promise<MarketCard[]> {
  const now    = new Date();
  const ago7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const ago24h = new Date(now.getTime() -      24 * 60 * 60 * 1000);
  const ago37d = new Date(now.getTime() - 37 * 24 * 60 * 60 * 1000);

  const activeBase = {
    isOutlier:  false,
    isStale:    false,
    trustScore: { gte: TRUST_THRESHOLD },
  } as const;

  // Q1: 候補 cardId
  const candidateRows = await prisma.price.groupBy({
    by:      ["cardId"],
    where:   { ...activeBase, capturedAt: { gte: ago7d } },
    _count:  { id: true },
    _avg:    { trustScore: true },
    having:  { id: { _count: { gte: MIN_OBS_7D } } },
    orderBy: { _count: { id: "desc" } },
    take:    CANDIDATE_LIMIT,
  });
  if (candidateRows.length === 0) return [];

  const candidateIds = candidateRows.map((r) => r.cardId);
  const trustMap     = new Map(candidateRows.map((r) => [r.cardId, r._avg.trustScore ?? 50]));
  const count7dMap   = new Map(candidateRows.map((r) => [r.cardId, r._count.id]));

  // Q2: 直近8日の価格（最新価格 + 24h count）
  const recentPrices = await prisma.price.findMany({
    where:   { cardId: { in: candidateIds }, ...activeBase, capturedAt: { gte: ago7d } },
    orderBy: { observedAt: "desc" },
    select:  { cardId: true, price: true, currency: true, observedAt: true, capturedAt: true },
  });
  const latestMap   = new Map<string, { price: number; currency: string }>();
  const count24hMap = new Map<string, number>();
  for (const p of recentPrices) {
    if (!latestMap.has(p.cardId)) latestMap.set(p.cardId, { price: p.price, currency: p.currency });
    if (p.capturedAt >= ago24h) count24hMap.set(p.cardId, (count24hMap.get(p.cardId) ?? 0) + 1);
  }

  // Q3: 7日前以前の価格（change7d 分母）
  const historyPrices = await prisma.price.findMany({
    where:   { cardId: { in: candidateIds }, ...activeBase, observedAt: { lte: ago7d, gte: ago37d } },
    orderBy: { observedAt: "desc" },
    select:  { cardId: true, price: true },
  });
  const price7dMap = new Map<string, number>();
  for (const p of historyPrices) {
    if (!price7dMap.has(p.cardId)) price7dMap.set(p.cardId, p.price);
  }

  // Q4: カードメタデータ
  const cards = await prisma.card.findMany({
    where:  { id: { in: candidateIds } },
    select: { id: true, name: true, setName: true, game: true, slug: true, rarity: true, condition: true },
  });
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // 集計
  const results: MarketCard[] = [];
  for (const cid of candidateIds) {
    const card       = cardMap.get(cid);
    if (!card) continue;
    const latest     = latestMap.get(cid)    ?? null;
    const old7d      = price7dMap.get(cid)   ?? null;
    const count24h   = count24hMap.get(cid)  ?? 0;
    const count7d    = count7dMap.get(cid)   ?? 0;
    const avgTrust   = trustMap.get(cid)     ?? 50;

    let change7d: number | null = null;
    let change7dAbs: number | null = null;
    if (latest !== null && old7d !== null && old7d > 0) {
      change7dAbs = latest.price - old7d;
      change7d    = (change7dAbs / old7d) * 100;
    }

    results.push({
      cardId:      card.id,
      slug:        card.slug,
      cardName:    card.name,
      setName:     card.setName,
      game:        card.game,
      rarity:      card.rarity,
      condition:   card.condition,
      latestPrice: latest?.price    ?? null,
      currency:    latest?.currency ?? null,
      change7d,
      change7dAbs,
      count24h,
      count7d,
      avgTrust,
      trendScore:  computeTrendScore(change7d, count24h, avgTrust),
    });
  }
  return results;
}

export async function getTrendingCards(limit = 30, game?: string): Promise<MarketCard[]> {
  const all = await fetchCandidates();
  return all
    .filter((c) => !game || c.game === game)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);
}

export async function getTopGainers(limit = 30, game?: string): Promise<MarketCard[]> {
  const all = await fetchCandidates();
  return all
    .filter((c) => (!game || c.game === game) && c.change7d !== null && c.change7d > 0)
    .sort((a, b) => (b.change7d ?? 0) - (a.change7d ?? 0))
    .slice(0, limit);
}

export async function getTopLosers(limit = 30, game?: string): Promise<MarketCard[]> {
  const all = await fetchCandidates();
  return all
    .filter((c) => (!game || c.game === game) && c.change7d !== null && c.change7d < 0)
    .sort((a, b) => (a.change7d ?? 0) - (b.change7d ?? 0))
    .slice(0, limit);
}

export async function getVolumeSpikes(limit = 30, game?: string): Promise<MarketCard[]> {
  const all = await fetchCandidates();
  return all
    .filter((c) => !game || c.game === game)
    .map((c) => {
      const dailyAvg = c.count7d / 7;
      const ratio    = dailyAvg > 0 ? c.count24h / dailyAvg : 0;
      return { ...c, _ratio: ratio };
    })
    .filter((c) => c.count24h >= 3 && c.count7d >= 10 && c._ratio >= 2)
    .sort((a, b) => b._ratio - a._ratio)
    .slice(0, limit);
}

// ================================================================
// (既存) Marketboard
// ================================================================

/**
 * Sort marketboard rows. Nulls always go to the end regardless of order,
 * so ascending sort doesn't surface a sea of "-" entries.
 */
function sortRows(
  rows: MarketboardRow[],
  key: MarketSortKey | null,
  order: MarketSortOrder,
): MarketboardRow[] {
  if (!key) return rows;

  const pluck = (row: MarketboardRow): number | null => {
    if (key === "price") return row.latestPrice;
    if (key === "changeRate") return row.changeRate;
    return row.dataPoints;
  };

  return [...rows].sort((a, b) => {
    const av = pluck(a);
    const bv = pluck(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return order === "asc" ? av - bv : bv - av;
  });
}
