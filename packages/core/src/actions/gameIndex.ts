"use server";

/**
 * gameIndex — ゲーム別指数（ポケカ指数・ワンピ指数 等）
 *
 * IndexValue にはゲーム別の格納列がないため（スキーマ変更なしの v1）、
 * Price 履歴からオンザフライで算出する。呼び出し側（ゲームハブページ）で
 * unstable_cache によるキャッシュを前提とする。
 *
 * 算出方法（2026-09-25 改定: 構成変化に頑健な「カード別変化率の中央値」方式）:
 *   - isOutlier / isStale を除外し、カードごとに窓内の重み付き平均を算出
 *   - 指数値 = 基準期間（ゲーム最古の30日窓）にデータがあったカードに限定し、
 *     各カードの「現在窓 ÷ 基準窓」比率の中央値 × 1000
 *     （後からカードを追加してもバスケットが変わらないため指数が跳ねない。
 *       旧方式は全価格プールの加重平均だったため、安価な新弾カードの大量追加で
 *       指数が-48%等の見かけ上の暴落を起こした）
 *   - 変化率 = 両方の窓に3件以上データがあるカードの変化率の中央値
 *     （中央値なので単一カードの乱高下にも頑健）
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

type Row = { cardId: string; price: number; trustScore: number; observedAt: Date; condition: string };

/** 変化率算出にカードを参加させる最低サンプル数（窓ごと） */
const MIN_SAMPLES_PER_WINDOW = 3;
/** 中央値の分母として必要な最低カード数（未満なら変化率は null） */
const MIN_CARDS_FOR_CHANGE = 5;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** [end-windowDays, end] 窓のカード別重み付き平均 */
function windowAggByCard(
  rows: Row[], end: number, windowDays: number,
): { byCard: Map<string, { agg: number; n: number }>; totalN: number } {
  const start = end - windowDays * DAY_MS;
  const grouped = new Map<string, PriceLike[]>();
  for (const r of rows) {
    const t = r.observedAt.getTime();
    if (t < start || t > end) continue;
    const arr = grouped.get(r.cardId);
    const like = { price: r.price, trustScore: r.trustScore, condition: r.condition };
    if (arr) arr.push(like); else grouped.set(r.cardId, [like]);
  }
  const byCard = new Map<string, { agg: number; n: number }>();
  let totalN = 0;
  for (const [cardId, likes] of grouped) {
    const agg = aggregatePrices(likes);
    if (agg !== null && agg > 0) byCard.set(cardId, { agg, n: likes.length });
    totalN += likes.length;
  }
  return { byCard, totalN };
}

/** 両窓に十分なデータがあるカードの変化率（%）の中央値 */
function medianChange(
  cur: Map<string, { agg: number; n: number }>,
  prev: Map<string, { agg: number; n: number }>,
): number | null {
  const ratios: number[] = [];
  for (const [cardId, c] of cur) {
    const p = prev.get(cardId);
    if (!p || c.n < MIN_SAMPLES_PER_WINDOW || p.n < MIN_SAMPLES_PER_WINDOW) continue;
    ratios.push((c.agg - p.agg) / p.agg * 100);
  }
  if (ratios.length < MIN_CARDS_FOR_CHANGE) return null;
  return median(ratios);
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
      cardId: true, price: true, trustScore: true, observedAt: true,
      card: { select: { condition: true } },
    },
  });
  const rows: Row[] = recent.map((p) => ({
    cardId: p.cardId, price: p.price, trustScore: p.trustScore, observedAt: p.observedAt, condition: p.card.condition,
  }));

  const current = windowAggByCard(rows, now, windowDays);
  const d1  = windowAggByCard(rows, now - 1 * DAY_MS,  windowDays);
  const d7  = windowAggByCard(rows, now - 7 * DAY_MS,  windowDays);
  const d30 = windowAggByCard(rows, now - 30 * DAY_MS, windowDays);

  const change24h = medianChange(current.byCard, d1.byCard);
  const change7d  = medianChange(current.byCard, d7.byCard);
  const change30d = medianChange(current.byCard, d30.byCard);

  // 表示用の平均価格（現在窓の全プール加重平均・参考値）
  const pooled: PriceLike[] = [];
  for (const r of rows) {
    const t = r.observedAt.getTime();
    if (t >= now - windowDays * DAY_MS) pooled.push({ price: r.price, trustScore: r.trustScore, condition: r.condition });
  }
  const averagePrice = pooled.length > 0 ? aggregatePrices(pooled) : null;

  // 指数値 = 基準期間（ゲーム最古の30日窓）バスケットのカード別比率の中央値 × 1000。
  // 基準窓にデータがあるカードだけが対象なので、後からのカード追加で跳ねない。
  let value: number | null = null;
  if (current.byCard.size > 0) {
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
          cardId: true, price: true, trustScore: true, observedAt: true,
          card: { select: { condition: true } },
        },
      });
      const baseRows: Row[] = base.map((p) => ({
        cardId: p.cardId, price: p.price, trustScore: p.trustScore, observedAt: p.observedAt, condition: p.card.condition,
      }));
      const baseByCard = windowAggByCard(baseRows, baseEnd, windowDays).byCard;

      // 段階的フォールバック: ①基準窓3件以上のカード → ②1件以上 →
      // ③それでも5枚未満なら従来のプール比（表示消滅よりは偏りありの値を優先）
      const collectRatios = (minBaseN: number): number[] => {
        const out: number[] = [];
        for (const [cardId, b] of baseByCard) {
          const c = current.byCard.get(cardId);
          if (!c || b.n < minBaseN) continue;
          out.push(c.agg / b.agg);
        }
        return out;
      };
      let ratios = collectRatios(MIN_SAMPLES_PER_WINDOW);
      if (ratios.length < MIN_CARDS_FOR_CHANGE) ratios = collectRatios(1);
      const med = median(ratios);
      if (med !== null && ratios.length >= MIN_CARDS_FOR_CHANGE) {
        value = med * 1000;
      } else {
        const basePool = aggregatePrices(baseRows.map((r) => ({ price: r.price, trustScore: r.trustScore, condition: r.condition })));
        if (basePool && basePool > 0 && averagePrice !== null) value = (averagePrice / basePool) * 1000;
      }
    }
  }

  const cardCount = await prisma.card.count({
    where: { ...cardWhere, prices: { some: {} } },
  });

  return {
    game,
    value,
    averagePrice,
    change24h,
    change7d,
    change30d,
    sampleCount: current.totalN,
    cardCount,
    confidence: computeConfidence(current.totalN, 0),
  };
}
