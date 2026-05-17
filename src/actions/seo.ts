"use server";

import { prisma }         from "@/lib/prisma";
import { TRUST_THRESHOLD } from "@/actions/admin";

// ----------------------------------------------------------------
// getGameStats — /games/[slug] ページ用
// ----------------------------------------------------------------

export type GameStats = {
  cardCount:   number;
  setCount:    number;
  priceCount:  number;
  latestPrice: number | null;
  currency:    string | null;
  sets:        SetSummary[];
};

export type SetSummary = {
  setName:    string;
  cardCount:  number;
  avgPrice:   number | null;
  currency:   string | null;
  latestObservedAt: string | null;
};

export async function getGameStats(game: string): Promise<GameStats | null> {
  const cards = await prisma.card.findMany({
    where: { game },
    select: {
      id:      true,
      setName: true,
      prices: {
        where: {
          isOutlier:  false,
          isStale:    false,
          trustScore: { gte: TRUST_THRESHOLD },
        },
        orderBy: { observedAt: "desc" },
        take:    1,
        select:  { price: true, currency: true, observedAt: true },
      },
    },
  });

  if (cards.length === 0) return null;

  // セット別集計
  const setMap = new Map<string, { prices: number[]; currencies: string[]; latest: Date | null }>();
  for (const card of cards) {
    const p = card.prices[0];
    const entry = setMap.get(card.setName) ?? { prices: [], currencies: [], latest: null };
    if (p) {
      entry.prices.push(p.price);
      entry.currencies.push(p.currency);
      if (!entry.latest || p.observedAt > entry.latest) entry.latest = p.observedAt;
    }
    setMap.set(card.setName, entry);
  }

  const sets: SetSummary[] = Array.from(setMap.entries())
    .map(([setName, data]) => {
      const avg = data.prices.length > 0
        ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length
        : null;
      const currency = data.currencies[0] ?? null;
      return {
        setName,
        cardCount:  data.prices.length,   // 価格あるカード数
        avgPrice:   avg,
        currency,
        latestObservedAt: data.latest?.toISOString() ?? null,
      };
    })
    .sort((a, b) => a.setName.localeCompare(b.setName));

  // 全体統計
  const allPrices = cards.flatMap((c) => c.prices.map((p) => p.price));
  const latestPriceRecord = cards
    .flatMap((c) => c.prices)
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0] ?? null;

  return {
    cardCount:   cards.length,
    setCount:    setMap.size,
    priceCount:  allPrices.length,
    latestPrice: latestPriceRecord?.price ?? null,
    currency:    latestPriceRecord?.currency ?? null,
    sets,
  };
}

// ----------------------------------------------------------------
// getSetStats — /sets/[slug] ページ用
// ----------------------------------------------------------------

export type SetStats = {
  setName:   string;
  game:      string | null;
  cardCount: number;
  cards:     SetCardSummary[];
};

export type SetCardSummary = {
  id:          string;
  slug:        string | null;
  name:        string;
  rarity:      string;
  condition:   string;
  latestPrice: number | null;
  currency:    string | null;
  change7d:    number | null;
  observedAt:  string | null;
};

export async function getSetStats(setNameSlug: string): Promise<SetStats | null> {
  // setName が直接一致するもの、またはスラッグ的に変換して一致するものを検索
  const cards = await prisma.card.findMany({
    where: {
      setName: { equals: setNameSlug, mode: "insensitive" },
    },
    select: {
      id:        true,
      slug:      true,
      name:      true,
      setName:   true,
      game:      true,
      rarity:    true,
      condition: true,
      prices: {
        where: {
          isOutlier:  false,
          isStale:    false,
          trustScore: { gte: TRUST_THRESHOLD },
        },
        orderBy: { observedAt: "desc" },
        take:    10,
        select:  { price: true, currency: true, observedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  if (cards.length === 0) return null;

  const now   = new Date();
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const summaries: SetCardSummary[] = cards.map((card) => {
    const latest = card.prices[0] ?? null;
    const old    = card.prices.find((p) => p.observedAt <= ago7d) ?? null;
    let change7d: number | null = null;
    if (latest && old && old.price > 0) {
      change7d = ((latest.price - old.price) / old.price) * 100;
    }
    return {
      id:          card.id,
      slug:        card.slug,
      name:        card.name,
      rarity:      card.rarity,
      condition:   card.condition,
      latestPrice: latest?.price ?? null,
      currency:    latest?.currency ?? null,
      change7d,
      observedAt:  latest?.observedAt.toISOString() ?? null,
    };
  });

  return {
    setName:   cards[0].setName,
    game:      cards[0].game,
    cardCount: cards.length,
    cards:     summaries,
  };
}

// ----------------------------------------------------------------
// getCardBySlug — /cards/[slug] ページ用
// ----------------------------------------------------------------

export type CardSeoDetail = {
  id:          string;
  slug:        string | null;
  name:        string;
  setName:     string;
  game:        string | null;
  rarity:      string;
  condition:   string;
  latestPrice: number | null;
  currency:    string | null;
  change7d:    number | null;
  change30d:   number | null;
  priceCount:  number;
  minPrice:    number | null;
  maxPrice:    number | null;
};

export async function getCardBySlug(slug: string): Promise<CardSeoDetail | null> {
  const card = await prisma.card.findUnique({
    where: { slug },
    include: {
      prices: {
        where: {
          isOutlier:  false,
          isStale:    false,
          trustScore: { gte: TRUST_THRESHOLD },
        },
        orderBy: { observedAt: "desc" },
        take:    60,
        select:  { price: true, currency: true, observedAt: true },
      },
    },
  });

  if (!card) return null;

  const now    = new Date();
  const ago7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const latest = card.prices[0] ?? null;
  const old7d  = card.prices.find((p) => p.observedAt <= ago7d)  ?? null;
  const old30d = card.prices.find((p) => p.observedAt <= ago30d) ?? null;

  const change7d = latest && old7d && old7d.price > 0
    ? ((latest.price - old7d.price)  / old7d.price)  * 100 : null;
  const change30d = latest && old30d && old30d.price > 0
    ? ((latest.price - old30d.price) / old30d.price) * 100 : null;

  const prices = card.prices.map((p) => p.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  return {
    id:          card.id,
    slug:        card.slug,
    name:        card.name,
    setName:     card.setName,
    game:        card.game,
    rarity:      card.rarity,
    condition:   card.condition,
    latestPrice: latest?.price ?? null,
    currency:    latest?.currency ?? null,
    change7d,
    change30d,
    priceCount:  card.prices.length,
    minPrice,
    maxPrice,
  };
}

// ----------------------------------------------------------------
// getAllSetNames — sitemap 用
// ----------------------------------------------------------------

export async function getAllSetNames(): Promise<string[]> {
  const rows = await prisma.card.findMany({
    select:  { setName: true },
    distinct: ["setName"],
    orderBy: { setName: "asc" },
  });
  return rows.map((r) => r.setName);
}

// ----------------------------------------------------------------
// getAllCardSlugs — sitemap 用
// ----------------------------------------------------------------

export async function getAllCardSlugs(): Promise<string[]> {
  const rows = await prisma.card.findMany({
    where:   { slug: { not: null } },
    select:  { slug: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => r.slug!);
}
