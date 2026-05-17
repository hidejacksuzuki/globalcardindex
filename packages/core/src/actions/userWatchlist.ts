"use server";

/**
 * userWatchlist.ts
 *
 * Server actions for the authenticated user's persistent watchlist.
 * Requires a valid Auth.js session (userId in session).
 *
 * These are distinct from the anonymous cookie-based watchlist
 * (packages/core/src/actions/watchlist.ts).
 */

import { revalidatePath } from "next/cache";
import { prisma }         from "@gci/db";
import { TRUST_THRESHOLD } from "./_helpers";

// ── Mutations ─────────────────────────────────────────────────────

export async function addToUserWatchlist(userId: string, cardId: string): Promise<void> {
  await prisma.userWatchlistItem.upsert({
    where:  { userId_cardId: { userId, cardId } },
    create: { userId, cardId },
    update: {},
  });
  revalidatePath("/account");
  revalidatePath("/watchlist");
}

export async function removeFromUserWatchlist(userId: string, cardId: string): Promise<void> {
  await prisma.userWatchlistItem.deleteMany({ where: { userId, cardId } });
  revalidatePath("/account");
  revalidatePath("/watchlist");
}

export async function isUserWatching(userId: string, cardId: string): Promise<boolean> {
  const item = await prisma.userWatchlistItem.findUnique({
    where: { userId_cardId: { userId, cardId } },
    select: { id: true },
  });
  return item !== null;
}

// ── Queries ───────────────────────────────────────────────────────

export type UserWatchlistCard = {
  cardId:      string;
  cardName:    string;
  setName:     string;
  rarity:      string;
  condition:   string;
  slug:        string | null;
  game:        string | null;
  addedAt:     Date;
  latestPrice: number | null;
  currency:    string | null;
  indexValue:  number | null;
  changeRate:  number | null;
  confidence:  string | null;
};

export async function getUserWatchlistCards(userId: string): Promise<UserWatchlistCard[]> {
  const items = await prisma.userWatchlistItem.findMany({
    where:   { userId },
    orderBy: { addedAt: "desc" },
    include: {
      card: {
        select: {
          id:        true,
          name:      true,
          setName:   true,
          rarity:    true,
          condition: true,
          slug:      true,
          game:      true,
        },
      },
    },
  });

  if (items.length === 0) return [];

  const cardIds = items.map((i) => i.cardId);

  // Latest prices
  const priceRows = await prisma.price.findMany({
    where:   {
      cardId:    { in: cardIds },
      isOutlier: false,
      isStale:   false,
      trustScore: { gte: TRUST_THRESHOLD },
    },
    orderBy: { observedAt: "desc" },
    select: { cardId: true, price: true, currency: true },
  });

  // Latest index values
  const indexRows = await prisma.indexValue.findMany({
    where:   { cardId: { in: cardIds } },
    orderBy: { calculatedAt: "desc" },
    select: { cardId: true, value: true, changeRate: true, confidence: true },
  });

  // De-duplicate: keep most-recent per card
  const priceMap = new Map<string, { price: number; currency: string }>();
  for (const row of priceRows) {
    if (!priceMap.has(row.cardId)) priceMap.set(row.cardId, { price: row.price, currency: row.currency });
  }
  const indexMap = new Map<string, { value: number; changeRate: number; confidence: string | null }>();
  for (const row of indexRows) {
    if (row.cardId && !indexMap.has(row.cardId)) {
      indexMap.set(row.cardId, { value: row.value, changeRate: row.changeRate, confidence: row.confidence });
    }
  }

  return items.map((item) => {
    const price = priceMap.get(item.cardId);
    const idx   = indexMap.get(item.cardId);
    return {
      cardId:      item.card.id,
      cardName:    item.card.name,
      setName:     item.card.setName,
      rarity:      item.card.rarity,
      condition:   item.card.condition,
      slug:        item.card.slug,
      game:        item.card.game,
      addedAt:     item.addedAt,
      latestPrice: price?.price ?? null,
      currency:    price?.currency ?? null,
      indexValue:  idx?.value ?? null,
      changeRate:  idx?.changeRate ?? null,
      confidence:  idx?.confidence ?? null,
    };
  });
}

// ── Migration: cookie watchlist → user watchlist ──────────────────

/**
 * Migrate items from the anonymous cookie-based Watchlist to the user's
 * UserWatchlistItem table. Called after sign-in if the session cookie exists.
 *
 * @param userId    The authenticated user's ID
 * @param sessionId The value of the gci_session cookie
 * @returns         Number of cards migrated
 */
export async function migrateAnonymousWatchlist(
  userId:    string,
  sessionId: string,
): Promise<number> {
  const watchlist = await prisma.watchlist.findUnique({
    where:   { sessionId },
    include: { items: { select: { cardId: true } } },
  });

  if (!watchlist || watchlist.items.length === 0) return 0;

  const cardIds = watchlist.items.map((i) => i.cardId);

  // Upsert all into UserWatchlistItem
  await Promise.all(
    cardIds.map((cardId) =>
      prisma.userWatchlistItem.upsert({
        where:  { userId_cardId: { userId, cardId } },
        create: { userId, cardId },
        update: {},
      }),
    ),
  );

  // Clean up the anonymous watchlist
  await prisma.watchlist.delete({ where: { id: watchlist.id } });

  revalidatePath("/account");
  return cardIds.length;
}
