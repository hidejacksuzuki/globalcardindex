"use server";

import { prisma, Prisma } from "@gci/db";
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

  // パフォーマンス改修 (2026-07-30):
  // 以前は include: { prices: take 200 } で「各カード最大200件×全カラム」を
  // 取得しており（実測 約4.6万行・30秒超）、表示に必要な
  // 「最新1件・30日窓の price/trustScore・件数・最新Index」だけを
  // それぞれ1クエリで取る形に分解した。応答形式は不変。
  const cards = await prisma.card.findMany({
    where: { ...buildCardSearchWhere(opts.search), isVisible: true, deletedAt: null },
    select: { id: true, name: true, setName: true, rarity: true, condition: true },
  });
  if (cards.length === 0) return [];

  const cardIds = cards.map((c) => c.id);
  const idList  = Prisma.join(cardIds);

  const [latestRows, countRows, windowRows, indexRows] = await Promise.all([
    // ① 各カードの最新価格1件（cardId+observedAt の複合インデックスを利用）
    prisma.$queryRaw<{ cardId: string; price: number; currency: string; observedAt: Date }[]>`
      SELECT DISTINCT ON ("cardId") "cardId", "price", "currency", "observedAt"
      FROM "Price" WHERE "cardId" IN (${idList})
      ORDER BY "cardId", "observedAt" DESC`,
    // ② 価格データ件数（dataPoints 表示用）
    prisma.price.groupBy({
      by: ["cardId"],
      where: { cardId: { in: cardIds } },
      _count: { _all: true },
    }),
    // ③ 変動率のベースライン計算に使う30日窓の価格（必要3カラムのみ）
    prisma.price.findMany({
      where:  { cardId: { in: cardIds }, observedAt: { gte: since } },
      select: { cardId: true, price: true, trustScore: true },
    }),
    // ④ 各カードの最新 IndexValue 1件
    prisma.$queryRaw<{ cardId: string; value: number; changeRate: number; sampleCount: number | null; confidence: string | null }[]>`
      SELECT DISTINCT ON ("cardId") "cardId", "value", "changeRate", "sampleCount", "confidence"
      FROM "IndexValue" WHERE "cardId" IN (${idList})
      ORDER BY "cardId", "calculatedAt" DESC`,
  ]);

  const latestMap = new Map(latestRows.map((r) => [r.cardId, r]));
  const countMap  = new Map(countRows.map((r) => [r.cardId, r._count._all]));
  const indexMap  = new Map(indexRows.map((r) => [r.cardId, r]));
  const windowMap = new Map<string, { price: number; trustScore: number }[]>();
  for (const r of windowRows) {
    const arr = windowMap.get(r.cardId);
    if (arr) arr.push(r); else windowMap.set(r.cardId, [r]);
  }

  const rows: MarketboardRow[] = cards.map((card) => {
    const latest       = latestMap.get(card.id) ?? null;
    const windowPrices = windowMap.get(card.id) ?? [];
    const baseline =
      windowPrices.length > 0 ? aggregatePrices(windowPrices) : null;

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
      dataPoints: countMap.get(card.id) ?? 0,
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
const MIN_REF_OBS_7D  = 3;    // change7d の基準値を採用する最低の参照窓観測数

// 週次で中央値がこの範囲を超える変化は、実質的に市場の値動きではなく
// 別カード混入や参照価格の破綻（データ品質問題）に由来する。急騰/急落
// ランキング等のヘッドラインから除外する（change7d を null 化）。
// 根本原因（誤マッチ汚染）は収集マッチング精度の改善で対処予定。
const MAX_PLAUSIBLE_GAIN_7D =  200;
const MIN_PLAUSIBLE_LOSS_7D = -80;

/** 数値配列の中央値。空なら null */
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

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
    // stale(収集停止)でも最後の既知価格は表示する。指数計算のみ除外する（indexCalculator）。
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
  const latestMap        = new Map<string, { price: number; currency: string }>();
  const count24hMap      = new Map<string, number>();
  const recentPricesMap  = new Map<string, number[]>();
  for (const p of recentPrices) {
    if (!latestMap.has(p.cardId)) latestMap.set(p.cardId, { price: p.price, currency: p.currency });
    if (p.capturedAt >= ago24h) count24hMap.set(p.cardId, (count24hMap.get(p.cardId) ?? 0) + 1);
    const arr = recentPricesMap.get(p.cardId) ?? [];
    arr.push(p.price);
    recentPricesMap.set(p.cardId, arr);
  }
  // change7d の分子は直近7日の「中央値」を使う（単一の最新価格が釣り出品や
  // 別コンディション安値だと ±数百% に爆発するため）。表示用 latestPrice は
  // 従来どおり最新の単一価格を用いる。
  const recentMedianMap = new Map<string, number>();
  for (const [cid, arr] of recentPricesMap) {
    const m = median(arr);
    if (m !== null && m > 0) recentMedianMap.set(cid, m);
  }

  // Q3: 7日前以前の価格（change7d 分母）
  // 以前は参照窓の「単一の最新価格」を分母にしていたため、その1点が釣り出品や
  // 別コンディションの安値だと change7d が ±数百% に爆発し、急騰/急落ランキングが
  // 薄データ由来のノイズで埋まっていた。参照窓の「中央値」を分母に使い、かつ
  // 最低 MIN_REF_OBS_7D 件の参照観測がある場合のみ基準値を採用する。
  const historyPrices = await prisma.price.findMany({
    where:   { cardId: { in: candidateIds }, ...activeBase, observedAt: { lte: ago7d, gte: ago37d } },
    orderBy: { observedAt: "desc" },
    select:  { cardId: true, price: true },
  });
  const refPricesMap = new Map<string, number[]>();
  for (const p of historyPrices) {
    const arr = refPricesMap.get(p.cardId) ?? [];
    arr.push(p.price);
    refPricesMap.set(p.cardId, arr);
  }
  const price7dMap = new Map<string, number>();
  for (const [cid, arr] of refPricesMap) {
    if (arr.length >= MIN_REF_OBS_7D) {
      const m = median(arr);
      if (m !== null && m > 0) price7dMap.set(cid, m);
    }
  }

  // Q4: カードメタデータ（非表示・削除済みを除外）
  const cards = await prisma.card.findMany({
    where:  { id: { in: candidateIds }, isVisible: true, deletedAt: null },
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

    // change7d は「直近中央値 vs 参照窓中央値」で算出（両端を中央値化して
    // 単一外れ値によるノイズを抑える）。change7dAbs は表示の一貫性のため
    // 中央値差で表す。
    const recentMed = recentMedianMap.get(cid) ?? null;
    let change7d: number | null = null;
    let change7dAbs: number | null = null;
    if (recentMed !== null && old7d !== null && old7d > 0) {
      const pct = ((recentMed - old7d) / old7d) * 100;
      // 妥当性ガード: 実質ありえない極端値はデータ品質問題なのでランキングから除外
      if (pct <= MAX_PLAUSIBLE_GAIN_7D && pct >= MIN_PLAUSIBLE_LOSS_7D) {
        change7dAbs = recentMed - old7d;
        change7d    = pct;
      }
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
// Game Snapshots — per-game weighted average change7d for homepage
// ================================================================

export type GameSnapshot = {
  game:      string;
  change7d:  number;   // weighted avg %
  cardCount: number;
};

/**
 * Returns per-game aggregate 7d change rates.
 * Uses the same candidate pool as Trending/Gainers.
 * Games with no data are omitted.
 */
export async function getGameSnapshots(): Promise<GameSnapshot[]> {
  const all = await fetchCandidates();

  const gameMap = new Map<string, { sum: number; count: number; total: number }>();
  for (const c of all) {
    if (!c.game || c.change7d === null) continue;
    const entry = gameMap.get(c.game) ?? { sum: 0, count: 0, total: 0 };
    entry.sum   += c.change7d;
    entry.count += 1;
    entry.total += 1;
    gameMap.set(c.game, entry);
  }

  const results: GameSnapshot[] = [];
  for (const [game, { sum, count }] of gameMap.entries()) {
    if (count < 3) continue;  // 少なすぎるゲームは除外
    results.push({ game, change7d: sum / count, cardCount: count });
  }
  return results.sort((a, b) => b.cardCount - a.cardCount);
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
