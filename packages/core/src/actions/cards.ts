"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@gci/db";
import type {
  CardSummary,
  CardSummaryWithPrice,
  CardWithPrices,
  CardSortKey,
  SortOrder,
  ListCardsResult,
} from "../types";
import { buildCardSearchWhere } from "./_helpers";
import { timedQuery } from "./_query-log";

// ----------------------------------------------------------------
// listCards オプション
// ----------------------------------------------------------------
export type ListCardsOptions = {
  search?:   string;
  sort?:     CardSortKey;
  order?:    SortOrder;
  page?:     number;
  pageSize?: number;
  skip?:     number;
  take?:     number;
  /** true のとき価格データが1件もないカードを除外（Web一覧用。API後方互換のためデフォルト false） */
  onlyWithPrices?: boolean;
};

const DEFAULT_PAGE_SIZE = 50;
const HARD_TAKE_LIMIT   = 200;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ----------------------------------------------------------------
// sort → Prisma orderBy に変換
// ----------------------------------------------------------------
function buildOrderBy(
  sort: CardSortKey = "name",
  order: SortOrder  = "asc",
): Prisma.CardOrderByWithRelationInput[] {
  // NOTE: sort === "latestPrice" はここでは扱わない。
  // Prisma のリレーション orderBy は _count のみ対応で、
  // { prices: { _max: ... } } は PrismaClientValidationError になる
  // （listCards 内の2段階クエリで処理する）。
  if (sort === "popular") {
    // 人気順 = 価格観測データの多さ（市場での取引・出品の活発さの代理指標）
    return [
      { prices: { _count: order } } as Prisma.CardOrderByWithRelationInput,
      { name: "asc" },
    ];
  }
  // デフォルト: 名前順
  return [{ name: order }, { setName: "asc" }];
}

// ----------------------------------------------------------------
// listCards — Week 2: 最新価格を含む CardSummaryWithPrice を返す
// ----------------------------------------------------------------
export async function listCards(
  opts: ListCardsOptions = {},
): Promise<ListCardsResult> {
  const baseWhere = buildCardSearchWhere(opts.search);
  const where: Prisma.CardWhereInput = opts.onlyWithPrices
    ? { ...baseWhere, prices: { some: {} } }
    : baseWhere;
  const orderBy = buildOrderBy(opts.sort, opts.order);

  let skip: number;
  let take: number;
  let page: number;
  let pageSize: number;

  if (opts.skip !== undefined || opts.take !== undefined) {
    take     = clamp(opts.take ?? DEFAULT_PAGE_SIZE, 1, HARD_TAKE_LIMIT);
    skip     = Math.max(0, opts.skip ?? 0);
    pageSize = take;
    page     = Math.floor(skip / take) + 1;
  } else {
    pageSize = clamp(opts.pageSize ?? DEFAULT_PAGE_SIZE, 1, HARD_TAKE_LIMIT);
    page     = Math.max(1, opts.page ?? 1);
    skip     = (page - 1) * pageSize;
    take     = pageSize;
  }

  // ── 価格順ソート: 2段階クエリ ──────────────────────────────
  // Prisma はリレーションの orderBy で _max を使えないため、
  // ① Price を cardId ごとに最大値で集計して並べ → ② その順でカードを取得する。
  if (opts.sort === "latestPrice") {
    const order = opts.order ?? "desc";

    const matching = await prisma.card.findMany({ where, select: { id: true } });
    const matchIds = matching.map((c) => c.id);

    const grouped = await prisma.price.groupBy({
      by:      ["cardId"],
      // 外れ値・stale を除外（¥9,999,999 のような釣り出品がソート上位を汚染するため）
      where:   { cardId: { in: matchIds }, isOutlier: false, isStale: false },
      _max:    { price: true },
      orderBy: [{ _max: { price: order } }],
    });

    let orderedIds = grouped.map((g) => g.cardId);
    if (!opts.onlyWithPrices) {
      // 価格なしカードは末尾に（従来の意図を踏襲）
      const withPrice = new Set(orderedIds);
      orderedIds = [...orderedIds, ...matchIds.filter((id) => !withPrice.has(id))];
    }

    const totalCount = orderedIds.length;
    const pageIds    = orderedIds.slice(skip, skip + take);

    const pageRows = await prisma.card.findMany({
      where:   { id: { in: pageIds } },
      include: {
        prices: {
          orderBy: { observedAt: "desc" },
          take:    1,
          select:  { price: true, currency: true, observedAt: true },
        },
      },
    });
    const rowMap = new Map(pageRows.map((c) => [c.id, c]));
    const rows   = pageIds
      .map((id) => rowMap.get(id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const cards: CardSummaryWithPrice[] = rows.map((c) => {
      const latest = c.prices[0] ?? null;
      return {
        id:             c.id,
        slug:           c.slug ?? null,
        name:           c.name,
        setName:        c.setName,
        rarity:         c.rarity,
        condition:      c.condition,
        latestPrice:    latest ? latest.price       : null,
        currency:       latest ? latest.currency    : null,
        lastObservedAt: latest ? latest.observedAt.toISOString() : null,
      };
    });
    return { cards, totalCount, page, pageSize, totalPages };
  }

  const [rows, totalCount] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        // 最新価格1件のみ取得（price 列表示用）
        prices: {
          orderBy: { observedAt: "desc" },
          take:    1,
          select:  { price: true, currency: true, observedAt: true },
        },
      },
    }),
    prisma.card.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const cards: CardSummaryWithPrice[] = rows.map((c) => {
    const latest = c.prices[0] ?? null;
    return {
      id:             c.id,
      slug:           c.slug ?? null,
      name:           c.name,
      setName:        c.setName,
      rarity:         c.rarity,
      condition:      c.condition,
      latestPrice:    latest ? latest.price       : null,
      currency:       latest ? latest.currency    : null,
      lastObservedAt: latest ? latest.observedAt.toISOString() : null,
    };
  });

  return { cards, totalCount, page, pageSize, totalPages };
}

// ----------------------------------------------------------------
// getCard — 詳細 + 価格履歴 30 件 (totalPriceCount で全件数を返す)
// ----------------------------------------------------------------
export async function getCard(id: string): Promise<CardWithPrices | null> {
  const card = await timedQuery(`getCard(${id})`, () =>
    prisma.card.findUnique({
      where: { id },
      include: {
        prices: { orderBy: { observedAt: "desc" }, take: 30 },
        _count: { select: { prices: true } },
      },
    }),
  );
  if (!card) return null;

  return {
    id:        card.id,
    name:      card.name,
    setName:   card.setName,
    rarity:    card.rarity,
    condition: card.condition,
    totalPriceCount: card._count.prices,
    prices: card.prices.map((p) => ({
      id:         p.id,
      price:      p.price,
      currency:   p.currency,
      sourceType: p.sourceType,
      sourceName: p.sourceName,
      observedAt: p.observedAt.toISOString(),
      trustScore: p.trustScore,
      notes:      p.notes,
    })),
  };
}

export type { CardSummary, CardSummaryWithPrice };
