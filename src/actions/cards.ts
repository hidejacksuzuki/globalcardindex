import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CardSummary,
  CardSummaryWithPrice,
  CardWithPrices,
  CardSortKey,
  SortOrder,
  ListCardsResult,
} from "@/types";

// ----------------------------------------------------------------
// 共通 WHERE 句（listCards / getMarketboard で共有）
// ----------------------------------------------------------------
export function buildCardSearchWhere(
  search?: string,
): Prisma.CardWhereInput | undefined {
  const trimmed = search?.trim();
  if (!trimmed) return undefined;
  return {
    OR: [
      { name:    { contains: trimmed, mode: "insensitive" } },
      { setName: { contains: trimmed, mode: "insensitive" } },
    ],
  };
}

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
  if (sort === "latestPrice") {
    // 最新価格の最大値で降順 / 昇順。価格なしのカードは末尾に。
    return [
      { prices: { _max: { price: order } } },
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
  const where = buildCardSearchWhere(opts.search);
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
// getCard — 詳細 + 価格履歴 200 件
// ----------------------------------------------------------------
export async function getCard(id: string): Promise<CardWithPrices | null> {
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      prices: { orderBy: { observedAt: "desc" }, take: 200 },
    },
  });
  if (!card) return null;

  return {
    id:        card.id,
    name:      card.name,
    setName:   card.setName,
    rarity:    card.rarity,
    condition: card.condition,
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
