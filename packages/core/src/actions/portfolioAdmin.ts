"use server";

import { prisma } from "@gci/db";
import type { PortfolioGrade } from "./portfolio";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

const PORTFOLIO_GRADES: PortfolioGrade[] = ["RAW", "PSA10", "PSA_OTHER", "OTHER_GRADED"];

export type GradeBreakdown = {
  grade: PortfolioGrade;
  count: number;
  pct:   number; // 0-100
};

export type PortfolioAnalyticsOverview = {
  totalUsers:              number;
  totalCardTypes:          number;
  totalQuantity:           number;
  avgQuantityPerUser:      number | null;
  gradeBreakdown:          GradeBreakdown[];
  watchToPortfolioCount:   number; // 件数: watchlist→portfolio に転換したペア数
  watchToPortfolioRate:    number | null; // %
};

export async function getPortfolioAnalyticsOverview(): Promise<PortfolioAnalyticsOverview> {
  const [totalUsersGroup, totalCardTypesGroup, quantitySum, gradeGroups, watchPairs, portfolioPairs] =
    await Promise.all([
      prisma.portfolioCard.groupBy({ by: ["userId"] }),
      prisma.portfolioCard.groupBy({ by: ["cardId"] }),
      prisma.portfolioCard.aggregate({ _sum: { quantity: true } }),
      prisma.portfolioCard.groupBy({ by: ["grade"], _count: { _all: true } }),
      prisma.userWatchlistItem.findMany({ select: { userId: true, cardId: true } }),
      prisma.portfolioCard.findMany({ select: { userId: true, cardId: true } }),
    ]);

  const totalUsers     = totalUsersGroup.length;
  const totalCardTypes = totalCardTypesGroup.length;
  const totalQuantity  = quantitySum._sum.quantity ?? 0;
  const totalEntries   = gradeGroups.reduce((s, g) => s + g._count._all, 0);

  const gradeBreakdown: GradeBreakdown[] = PORTFOLIO_GRADES.map((grade) => {
    const found = gradeGroups.find((g) => g.grade === grade);
    const count = found?._count._all ?? 0;
    return {
      grade,
      count,
      pct: totalEntries > 0 ? (count / totalEntries) * 100 : 0,
    };
  });

  // Watchlist → Portfolio conversion: (userId, cardId) ペアが両方に存在する数
  const portfolioSet = new Set(portfolioPairs.map((p) => `${p.userId}:${p.cardId}`));
  const watchToPortfolioCount = watchPairs.filter((w) => portfolioSet.has(`${w.userId}:${w.cardId}`)).length;
  const watchToPortfolioRate  = watchPairs.length > 0 ? (watchToPortfolioCount / watchPairs.length) * 100 : null;

  return {
    totalUsers,
    totalCardTypes,
    totalQuantity,
    avgQuantityPerUser: totalUsers > 0 ? totalQuantity / totalUsers : null,
    gradeBreakdown,
    watchToPortfolioCount,
    watchToPortfolioRate,
  };
}

// ----------------------------------------------------------------
// Card-level table
// ----------------------------------------------------------------

export type PortfolioCardSort =
  | "registered_desc"
  | "value_desc"
  | "recent_desc";

export type PortfolioCardFilter = {
  game?:   string;
  grade?:  PortfolioGrade;
  search?: string;
  sort?:   PortfolioCardSort;
};

export type PortfolioCardRow = {
  cardId:               string;
  cardName:             string;
  game:                 string | null;
  setName:              string;
  slug:                 string | null;
  grade:                PortfolioGrade;
  registeredUsersCount: number;
  totalQuantity:        number;
  avgBuyPrice:          number | null;
  currentMarketPrice:   number | null;
  currency:             string | null;
  totalEstimatedValue:  number | null;
  registeredCount7d:    number;
  lastRegisteredAt:     string; // ISO
};

export async function getPortfolioCardRows(
  filter: PortfolioCardFilter = {},
): Promise<PortfolioCardRow[]> {
  const { game, grade, search, sort = "registered_desc" } = filter;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const cardWhere: Record<string, unknown> = {};
  if (game)   cardWhere.game = game;
  if (search) cardWhere.name = { contains: search, mode: "insensitive" };

  const groups = await prisma.portfolioCard.groupBy({
    by:      ["cardId", "grade"],
    where: {
      ...(grade ? { grade } : {}),
      ...(Object.keys(cardWhere).length > 0 ? { card: cardWhere } : {}),
    },
    _count:  { _all: true },
    _sum:    { quantity: true },
    _avg:    { avgBuyPrice: true },
    _max:    { createdAt: true },
  });

  if (groups.length === 0) return [];

  const cardIds = [...new Set(groups.map((g) => g.cardId))];

  const [cards, recent7dGroups, prices] = await Promise.all([
    prisma.card.findMany({
      where:  { id: { in: cardIds } },
      select: { id: true, name: true, setName: true, game: true, slug: true },
    }),
    prisma.portfolioCard.groupBy({
      by:     ["cardId", "grade"],
      where:  { cardId: { in: cardIds }, createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.price.findMany({
      where: {
        cardId:     { in: cardIds },
        isOutlier:  false,
        isStale:    false,
      },
      orderBy: { observedAt: "desc" },
      distinct: ["cardId"],
      select:   { cardId: true, price: true, currency: true },
    }),
  ]);

  const cardMap    = new Map(cards.map((c) => [c.id, c]));
  const recent7dMap = new Map(
    recent7dGroups.map((g) => [`${g.cardId}:${g.grade}`, g._count._all]),
  );
  const priceMap = new Map(prices.map((p) => [p.cardId, p]));

  const rows: PortfolioCardRow[] = groups.map((g) => {
    const card         = cardMap.get(g.cardId);
    const price        = priceMap.get(g.cardId) ?? null;
    const totalQuantity = g._sum.quantity ?? 0;
    const totalEstimatedValue = price ? totalQuantity * price.price : null;

    return {
      cardId:               g.cardId,
      cardName:             card?.name ?? g.cardId,
      game:                 card?.game ?? null,
      setName:              card?.setName ?? "—",
      slug:                 card?.slug ?? null,
      grade:                (g.grade as PortfolioGrade) ?? "RAW",
      registeredUsersCount: g._count._all,
      totalQuantity,
      avgBuyPrice:          g._avg.avgBuyPrice,
      currentMarketPrice:   price?.price ?? null,
      currency:             price?.currency ?? null,
      totalEstimatedValue,
      registeredCount7d:    recent7dMap.get(`${g.cardId}:${g.grade}`) ?? 0,
      lastRegisteredAt:     (g._max.createdAt ?? new Date(0)).toISOString(),
    };
  });

  // card 情報が見つからないもの（削除済みカード等）は除外しない — id で表示

  switch (sort) {
    case "value_desc":
      rows.sort((a, b) => (b.totalEstimatedValue ?? -1) - (a.totalEstimatedValue ?? -1));
      break;
    case "recent_desc":
      rows.sort((a, b) => new Date(b.lastRegisteredAt).getTime() - new Date(a.lastRegisteredAt).getTime());
      break;
    case "registered_desc":
    default:
      rows.sort((a, b) => b.registeredUsersCount - a.registeredUsersCount);
      break;
  }

  return rows;
}

// ----------------------------------------------------------------
// CSV export
// ----------------------------------------------------------------

function csvEscape(val: string | number | null): string {
  if (val === null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function getPortfolioCardRowsCsv(filter: PortfolioCardFilter = {}): Promise<string> {
  const rows = await getPortfolioCardRows(filter);
  const header = [
    "card_name", "game", "set", "grade",
    "registered_users_count", "total_quantity", "avg_buy_price",
    "current_market_price", "total_estimated_value",
    "registered_count_7d", "last_registered_at",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.cardName),
      csvEscape(r.game),
      csvEscape(r.setName),
      csvEscape(r.grade),
      csvEscape(r.registeredUsersCount),
      csvEscape(r.totalQuantity),
      csvEscape(r.avgBuyPrice !== null ? Math.round(r.avgBuyPrice) : null),
      csvEscape(r.currentMarketPrice),
      csvEscape(r.totalEstimatedValue !== null ? Math.round(r.totalEstimatedValue) : null),
      csvEscape(r.registeredCount7d),
      csvEscape(r.lastRegisteredAt),
    ].join(","));
  }
  return lines.join("\n");
}
