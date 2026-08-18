"use server";

/**
 * gameIndex — ゲーム別指数（ポケカ指数・ワンピ指数 等）
 *
 * IndexValue にはゲーム別の格納列がないため（スキーマ変更なしの v1）、
 * Price 履歴からオンザフライで算出する。呼び出し側（ゲームハブページ）で
 * unstable_cache によるキャッシュを前提とする。
 *
 * 算出方法は calculateIndex（全体GCI指数）と同じ流儀:
 *   - isOutlier / isStale を除外し、trustScore×コンディション重み付き平均
 *   - 基準 = そのゲーム最古の30日窓の集計値を 1000 とする相対値
 *   - 変化率 = 現在窓の集計値 vs 1日前/7日前/30日前を終端とする窓の集計値
 */

import { prisma } from "@gci/db";
import {
  aggregatePrices,
  computeConfidence,
  DEFAULT_WINDOW_DAYS,
  type ConfidenceTier,
  type PriceLike,
} from "../engine/indexCalculator";

export type GameIndexResult = {
  game:         string;
  value:        number | null;   // 基準1000の指数値（基準期間が確立するまで null）
  averagePrice: number | null;   // 現在窓の加重平均（円）
  change24h:    number | null;   // %（前日終端窓との比較）
  change7d:     number | null;
  change30d:    number | null;
  sampleCount:  number;          // 現在窓のサンプル数
  cardCount:    number;          // 価格データを持つゲーム内カード数
  confidence:   ConfidenceTier;
};

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = { price: number; trustScore: number; observedAt: Date; condition: string };

/** [end-windowDays, end] 窓の加重平均を返す */
function windowAgg(rows: Row[], end: number, windowDays: number): { agg: number | null; n: number } {
  const start = end - windowDays * DAY_MS;
  const w: PriceLike[] = [];
  for (const r of rows) {
    const t = r.observedAt.getTime();
    if (t >= start && t <= end) w.push({ price: r.price, trustScore: r.trustScore, condition: r.condition });
  }
  return { agg: w.length > 0 ? aggregatePrices(w) : null, n: w.length };
}

export async function getGameIndex(
  game: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<GameIndexResult> {
  const now = Date.now();
  const cardWhere = { game, isVisible: true, deletedAt: null } as const;

  // 直近60日分（現在窓＋30日前終端窓をカバー）を一括取得
  const recent = await prisma.price.findMany({
    where: {
      card: cardWhere,
      isOutlier: false,
      isStale:   false,
      observedAt: { gte: new Date(now - (windowDays + 30) * DAY_MS) },
    },
    select: {
      price: true, trustScore: true, observedAt: true,
      card: { select: { condition: true } },
    },
  });
  const rows: Row[] = recent.map((p) => ({
    price: p.price, trustScore: p.trustScore, observedAt: p.observedAt, condition: p.card.condition,
  }));

  const current = windowAgg(rows, now, windowDays);
  const d1  = windowAgg(rows, now - 1 * DAY_MS,  windowDays);
  const d7  = windowAgg(rows, now - 7 * DAY_MS,  windowDays);
  const d30 = windowAgg(rows, now - 30 * DAY_MS, windowDays);

  const pct = (prev: number | null): number | null =>
    current.agg !== null && prev !== null && prev !== 0
      ? ((current.agg - prev) / prev) * 100
      : null;

  // 基準期間（ゲーム最古の30日窓）→ 指数の絶対値
  let value: number | null = null;
  if (current.agg !== null) {
    const earliest = await prisma.price.findFirst({
      where:   { card: cardWhere, isOutlier: false, isStale: false },
      orderBy: { observedAt: "asc" },
      select:  { observedAt: true },
    });
    if (earliest) {
      const baseEnd = earliest.observedAt.getTime() + windowDays * DAY_MS;
      const base = await prisma.price.findMany({
        where: {
          card: cardWhere,
          isOutlier: false,
          isStale:   false,
          observedAt: { gte: earliest.observedAt, lte: new Date(baseEnd) },
        },
        select: {
          price: true, trustScore: true,
          card: { select: { condition: true } },
        },
      });
      const baseAgg = base.length > 0
        ? aggregatePrices(base.map((p) => ({ price: p.price, trustScore: p.trustScore, condition: p.card.condition })))
        : null;
      if (baseAgg && baseAgg > 0) value = (current.agg / baseAgg) * 1000;
    }
  }

  const cardCount = await prisma.card.count({
    where: { ...cardWhere, prices: { some: {} } },
  });

  return {
    game,
    value,
    averagePrice: current.agg,
    change24h:  pct(d1.agg),
    change7d:   pct(d7.agg),
    change30d:  pct(d30.agg),
    sampleCount: current.n,
    cardCount,
    confidence: computeConfidence(current.n, 0),
  };
}
