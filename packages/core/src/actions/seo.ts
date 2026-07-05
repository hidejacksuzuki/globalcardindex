"use server";

import { prisma }         from "@gci/db";
import { TRUST_THRESHOLD } from "./_helpers";
import { timedQuery }      from "./_query-log";

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
  const cards = await timedQuery(`getGameStats(${game})`, () => prisma.card.findMany({
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
  }));

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

export async function getSetStats(rawSetNameSlug: string): Promise<SetStats | null> {
  // Next.js の dynamic params は percent エンコードされたまま渡ってくることがある
  // （"SV2a%20151" 等で 404 になるのを防ぐ）
  let setNameSlug = rawSetNameSlug;
  try { setNameSlug = decodeURIComponent(rawSetNameSlug); } catch { /* raw のまま */ }

  // setName が直接一致するもの、またはスラッグ的に変換して一致するものを検索
  const cards = await timedQuery(`getSetStats(${setNameSlug})`, () => prisma.card.findMany({
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
  }));

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
  medianPrice: number | null;
  maxPrice:    number | null;
  /** 算出に使ったサンプルのトラストスコア平均 (0-100)。Price Confidence 表示用 */
  avgTrust:    number | null;
  /** 最新の価格観測時刻 (ISO)。「◯時間前に更新」表示用 */
  lastObservedAt: string | null;
};

export async function getCardBySlug(rawSlug: string): Promise<CardSeoDetail | null> {
  // Next.js の dynamic params は percent エンコードされたまま渡ってくることがある
  // （日本語 slug のカードが 404 になるバグの修正）
  let slug = rawSlug;
  try { slug = decodeURIComponent(rawSlug); } catch { /* 不正な % はそのまま扱う */ }

  const card = await prisma.card.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      prices: {
        where: {
          isOutlier:  false,
          isStale:    false,
          trustScore: { gte: TRUST_THRESHOLD },
        },
        orderBy: { observedAt: "desc" },
        take:    60,
        select:  { price: true, currency: true, observedAt: true, trustScore: true },
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
  const minPrice    = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice    = prices.length > 0 ? Math.max(...prices) : null;
  const avgTrust    = card.prices.length > 0
    ? Math.round(card.prices.reduce((s, p) => s + p.trustScore, 0) / card.prices.length)
    : null;
  const sorted      = [...prices].sort((a, b) => a - b);
  const mid         = Math.floor(sorted.length / 2);
  const medianPrice = sorted.length > 0
    ? sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
    : null;

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
    medianPrice,
    maxPrice,
    avgTrust,
    lastObservedAt: latest?.observedAt.toISOString() ?? null,
  };
}

// ----------------------------------------------------------------
// getCardPriceHistory — 価格推移チャート用 (90日分を一括取得)
// ----------------------------------------------------------------

export type PricePoint = {
  date:     string;   // ISO 8601
  price:    number;
  currency: string;
};

export async function getCardPriceHistory(
  cardId: string,
  days:   number = 90,
): Promise<PricePoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await prisma.price.findMany({
    where: {
      cardId,
      observedAt: { gte: since },
      isOutlier:  false,
      isStale:    false,
      trustScore: { gte: TRUST_THRESHOLD },
    },
    orderBy: { observedAt: "asc" },
    select:  { price: true, currency: true, observedAt: true },
    take:    500,
  });

  return rows.map((r) => ({
    date:     r.observedAt.toISOString(),
    price:    r.price,
    currency: r.currency,
  }));
}

// ----------------------------------------------------------------
// getCardSourceStats — ソース別相場
// PriceSnapshot 優先、なければ Price テーブルから集計
// ----------------------------------------------------------------

export type CardSourceStat = {
  source:      string;          // raw key: "mercari" | "yahuoku" | "ebay" …
  currency:    string;
  minPrice:    number | null;
  medianPrice: number | null;
  avgPrice:    number | null;
  maxPrice:    number | null;
  sampleCount: number;
  capturedAt:  string;          // ISO 8601
};

export async function getCardSourceStats(cardId: string): Promise<CardSourceStat[]> {
  // 1. PriceSnapshot 優先（承認フロー経由で既に集計済み）
  const snapshots = await prisma.priceSnapshot.findMany({
    where:   { cardId },
    orderBy: { capturedAt: "desc" },
  });

  if (snapshots.length > 0) {
    const map = new Map<string, typeof snapshots[0]>();
    for (const s of snapshots) {
      if (!map.has(s.source)) map.set(s.source, s);
    }
    return [...map.values()].map((s) => ({
      source:      s.source,
      currency:    "JPY",
      minPrice:    s.minPrice,
      medianPrice: s.medianPrice,
      avgPrice:    s.avgPrice,
      maxPrice:    s.maxPrice,
      sampleCount: s.sampleCount,
      capturedAt:  s.capturedAt.toISOString(),
    }));
  }

  // 2. フォールバック: Price テーブルから sourceName ごとに集計
  const rows = await prisma.price.findMany({
    where: {
      cardId,
      isOutlier:  false,
      isStale:    false,
      trustScore: { gte: TRUST_THRESHOLD },
    },
    orderBy: { capturedAt: "desc" },
    select: {
      price:      true,
      currency:   true,
      sourceName: true,
      capturedAt: true,
    },
    take: 500,
  });

  if (rows.length === 0) return [];

  // sourceName でグループ化
  const groups = new Map<string, { prices: number[]; currency: string; latest: Date }>();
  for (const r of rows) {
    const key   = r.sourceName;
    const entry = groups.get(key) ?? { prices: [], currency: r.currency, latest: r.capturedAt };
    entry.prices.push(r.price);
    if (r.capturedAt > entry.latest) entry.latest = r.capturedAt;
    groups.set(key, entry);
  }

  return [...groups.entries()]
    .map(([source, { prices: ps, currency, latest }]) => {
      const sorted = [...ps].sort((a, b) => a - b);
      const mid    = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
      return {
        source,
        currency,
        minPrice:    sorted[0],
        medianPrice: median,
        avgPrice:    ps.reduce((a, b) => a + b, 0) / ps.length,
        maxPrice:    sorted[sorted.length - 1],
        sampleCount: ps.length,
        capturedAt:  latest.toISOString(),
      };
    })
    .sort((a, b) => b.sampleCount - a.sampleCount);
}

// ----------------------------------------------------------------
// getCardEngagement — カード詳細の「熱量」指標
// ウォッチ数・保有者数・直近の取引（実データのみ、推定値なし）
// ----------------------------------------------------------------

export type RecentSale = {
  price:      number;
  currency:   string;
  observedAt: string; // ISO
  sold:       boolean; // true = 落札確認済み / false = 出品観測
};

export type CardEngagement = {
  watchers:    number;       // ウォッチしている人数（ログイン + 匿名セッション）
  holders:     number;       // Portfolio に登録している人数
  recentSales: RecentSale[]; // 直近の取引（落札優先、なければ価格観測）
};

export async function getCardEngagement(cardId: string): Promise<CardEngagement> {
  const [userWatch, anonWatch, holders, sold] = await Promise.all([
    prisma.userWatchlistItem.count({ where: { cardId } }),
    prisma.watchlistItem.count({ where: { cardId } }),
    prisma.portfolioCard.count({ where: { cardId } }),
    prisma.price.findMany({
      where: {
        cardId,
        availability: "sold",
        isOutlier:    false,
        trustScore:   { gte: TRUST_THRESHOLD },
      },
      orderBy: { observedAt: "desc" },
      take:    5,
      select:  { price: true, currency: true, observedAt: true },
    }),
  ]);

  // 落札データがまだ収集されていないカードは、直近の価格観測でフォールバック
  // （sold と観測はバッジで明確に区別して表示する）
  let recentSales: RecentSale[] = sold.map((s) => ({
    price:      s.price,
    currency:   s.currency,
    observedAt: s.observedAt.toISOString(),
    sold:       true,
  }));

  if (recentSales.length === 0) {
    const observed = await prisma.price.findMany({
      where: {
        cardId,
        isOutlier:  false,
        isStale:    false,
        trustScore: { gte: TRUST_THRESHOLD },
      },
      orderBy: { observedAt: "desc" },
      take:    5,
      select:  { price: true, currency: true, observedAt: true },
    });
    recentSales = observed.map((s) => ({
      price:      s.price,
      currency:   s.currency,
      observedAt: s.observedAt.toISOString(),
      sold:       false,
    }));
  }

  return { watchers: userWatch + anonWatch, holders, recentSales };
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
