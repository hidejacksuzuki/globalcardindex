"use server";

import { prisma } from "@gci/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PortfolioGrade = "RAW" | "PSA10" | "PSA_OTHER" | "OTHER_GRADED";

export type PortfolioItem = {
  id:                 string;
  cardId:             string;
  name:               string;
  setName:            string;
  rarity:             string;
  condition:          string;
  game:               string | null;
  slug:               string | null;
  quantity:           number;
  avgBuyPrice:        number | null;
  memo:               string | null;
  grade:              PortfolioGrade;
  currentPrice:       number | null;
  currency:           string | null;
  evaluatedValue:     number | null;
  cost:               number | null;
  unrealizedGain:     number | null;
  unrealizedGainPct:  number | null;
  createdAt:          string;
};

export type PortfolioSummary = {
  totalCards:         number;
  totalQuantity:      number;
  totalValue:         number | null;
  totalCost:          number | null;
  unrealizedGain:     number | null;
  unrealizedGainPct:  number | null;
};

export type PortfolioStatus = {
  inPortfolio:    boolean;
  portfolioCard?: {
    id:           string;
    quantity:     number;
    avgBuyPrice:  number | null;
    memo:         string | null;
    grade:        PortfolioGrade;
  };
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getPortfolio(userId: string): Promise<PortfolioItem[]> {
  const rows = await prisma.portfolioCard.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    1000,
    include: {
      card: {
        select: {
          id: true, name: true, setName: true, rarity: true, condition: true,
          game: true, slug: true,
          prices: {
            where:   { isOutlier: false },
            orderBy: { observedAt: "desc" },
            take:    1,
            select:  { price: true, currency: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const p               = row.card.prices[0] ?? null;
    const currentPrice    = p?.price ?? null;
    const currency        = p?.currency ?? null;
    const evaluatedValue  = currentPrice !== null ? row.quantity * currentPrice : null;
    const cost            = row.avgBuyPrice !== null ? row.quantity * row.avgBuyPrice : null;
    const unrealizedGain  = evaluatedValue !== null && cost !== null ? evaluatedValue - cost : null;
    const unrealizedGainPct =
      unrealizedGain !== null && cost !== null && cost > 0
        ? (unrealizedGain / cost) * 100
        : null;

    return {
      id:                row.id,
      cardId:            row.cardId,
      name:              row.card.name,
      setName:           row.card.setName,
      rarity:            row.card.rarity,
      condition:         row.card.condition,
      game:              row.card.game,
      slug:              row.card.slug,
      quantity:          row.quantity,
      avgBuyPrice:       row.avgBuyPrice,
      memo:              row.memo,
      grade:             (row.grade as PortfolioGrade) ?? "RAW",
      currentPrice,
      currency,
      evaluatedValue,
      cost,
      unrealizedGain,
      unrealizedGainPct,
      createdAt:         row.createdAt.toISOString(),
    };
  });
}

export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const items          = await getPortfolio(userId);
  const totalCards     = items.length;
  const totalQuantity  = items.reduce((s, i) => s + i.quantity, 0);
  const hasValue       = items.some((i) => i.evaluatedValue !== null);
  const hasCost        = items.some((i) => i.cost !== null);
  const totalValue     = hasValue ? items.reduce((s, i) => s + (i.evaluatedValue ?? 0), 0) : null;
  const totalCost      = hasCost  ? items.reduce((s, i) => s + (i.cost ?? 0), 0) : null;
  const unrealizedGain = totalValue !== null && totalCost !== null ? totalValue - totalCost : null;
  const unrealizedGainPct =
    unrealizedGain !== null && totalCost !== null && totalCost > 0
      ? (unrealizedGain / totalCost) * 100
      : null;

  return { totalCards, totalQuantity, totalValue, totalCost, unrealizedGain, unrealizedGainPct };
}

export async function isInPortfolio(userId: string, cardId: string): Promise<PortfolioStatus> {
  const row = await prisma.portfolioCard.findUnique({
    where:  { userId_cardId: { userId, cardId } },
    select: { id: true, quantity: true, avgBuyPrice: true, memo: true, grade: true },
  });
  if (!row) return { inPortfolio: false };
  return {
    inPortfolio:  true,
    portfolioCard: { ...row, grade: (row.grade as PortfolioGrade) ?? "RAW" },
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function addToPortfolio(
  userId: string,
  data: { cardId: string; quantity: number; avgBuyPrice?: number | null; memo?: string | null; grade?: PortfolioGrade | null },
) {
  return prisma.portfolioCard.upsert({
    where:  { userId_cardId: { userId, cardId: data.cardId } },
    update: { quantity: data.quantity, avgBuyPrice: data.avgBuyPrice ?? null, memo: data.memo ?? null, grade: data.grade ?? "RAW" },
    create: { userId, cardId: data.cardId, quantity: data.quantity, avgBuyPrice: data.avgBuyPrice ?? null, memo: data.memo ?? null, grade: data.grade ?? "RAW" },
  });
}

export async function updatePortfolio(
  userId: string,
  id: string,
  data: { quantity?: number; avgBuyPrice?: number | null; memo?: string | null; grade?: PortfolioGrade | null },
) {
  return prisma.portfolioCard.update({
    where: { id, userId },
    data:  {
      ...(data.quantity     !== undefined ? { quantity:     data.quantity }        : {}),
      ...(data.avgBuyPrice  !== undefined ? { avgBuyPrice:  data.avgBuyPrice }     : {}),
      ...(data.memo         !== undefined ? { memo:         data.memo }            : {}),
      ...(data.grade        !== undefined ? { grade:        data.grade ?? "RAW" }  : {}),
    },
  });
}

export async function removeFromPortfolio(userId: string, id: string) {
  return prisma.portfolioCard.delete({ where: { id, userId } });
}
