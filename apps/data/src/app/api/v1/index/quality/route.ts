/**
 * GET /api/v1/index/quality
 *
 * Returns per-card index quality data for the admin dashboard.
 *
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     cards:  CardIndexRow[],   // latest IndexValue per card
 *     global: GlobalIndexRow[], // global GCI history (last 30)
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (
    secret.length >= 16 &&
    auth.startsWith("Bearer ") &&
    timingSafeEqual(auth.slice(7).trim(), secret)
  ) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ── 1. All cards ──────────────────────────────────────────────────────────
  const allCards = await prisma.card.findMany({
    select: {
      id:        true,
      name:      true,
      setName:   true,
      rarity:    true,
      condition: true,
      indexValues: {
        orderBy: { calculatedAt: "desc" },
        take:    1,
        select: {
          value:        true,
          changeRate:   true,
          sampleCount:  true,
          outlierCount: true,
          confidence:   true,
          calculatedAt: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { condition: "asc" }],
  });

  // Fetch average price per card (most recent non-outlier, non-stale price avg)
  const cardIds = allCards.map((c) => c.id);
  const avgRows = await prisma.price.groupBy({
    by:     ["cardId"],
    where:  { cardId: { in: cardIds }, isOutlier: false, isStale: false },
    _avg:   { price: true },
  });
  const avgMap = new Map(avgRows.map((r) => [r.cardId, r._avg.price]));

  const cards = allCards.map((c) => {
    const latest = c.indexValues[0] ?? null;
    return {
      cardId:       c.id,
      name:         c.name,
      setName:      c.setName,
      rarity:       c.rarity,
      condition:    c.condition,
      value:        latest?.value        ?? null,
      changeRate:   latest?.changeRate   ?? null,
      sampleCount:  latest?.sampleCount  ?? null,
      outlierCount: latest?.outlierCount ?? null,
      confidence:   latest?.confidence   ?? null,
      calculatedAt: latest?.calculatedAt.toISOString() ?? null,
      averagePrice: avgMap.get(c.id) ?? null,
    };
  });

  // ── 2. Global index history (last 30) ─────────────────────────────────────
  const globalRows = await prisma.indexValue.findMany({
    where:   { cardId: null },
    orderBy: { calculatedAt: "desc" },
    take:    30,
    select: {
      id:           true,
      value:        true,
      changeRate:   true,
      sampleCount:  true,
      outlierCount: true,
      confidence:   true,
      calculatedAt: true,
    },
  });

  const global = globalRows.map((r) => ({
    ...r,
    calculatedAt: r.calculatedAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, data: { cards, global } });
}
