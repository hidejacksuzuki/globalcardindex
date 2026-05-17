/**
 * GET /api/v1/collector/review-data
 *
 * Returns CollectorRun items enriched with median deviation data.
 * Used exclusively by /admin/collector/review.
 *
 * Query params:
 *   ?session=SESSION_ID   — filter to one session (optional)
 *   ?limit=N              — max rows returned (default 200)
 *
 * Auth: admin referer or CRON_SECRET
 *
 * Response:
 * {
 *   ok:    true,
 *   items: CollectorRun[] + { medianWarning, medianRatio, medianValue }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { computeMedianDeviation, timingSafeEqual } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session") ?? undefined;
  const limit     = Math.min(Number(searchParams.get("limit") ?? "200"), 500);

  // ── Load CollectorRun items ────────────────────────────────────────────────
  const runs = await prisma.collectorRun.findMany({
    where:   sessionId ? { sessionId } : undefined,
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  if (runs.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  // ── Enrich with median deviation ──────────────────────────────────────────
  // For efficiency: group by (cardName, setName, rarity, condition) and
  // load prices once per unique combination.
  type CardKey = string;
  const priceCache = new Map<CardKey, number[]>();

  const key = (r: typeof runs[0]): CardKey =>
    `${r.cardName ?? ""}|${r.setName ?? ""}|${r.rarity ?? ""}|${r.condition ?? ""}`;

  // Collect unique keys that have enough metadata for a price lookup
  const uniqueKeys = new Set(
    runs
      .filter((r) => r.cardName && r.setName && r.condition)
      .map(key),
  );

  await Promise.all(
    [...uniqueKeys].map(async (k) => {
      const [name, setName, rarity, condition] = k.split("|");
      const prices = await prisma.price.findMany({
        where: {
          card: {
            name:      { equals: name,      mode: "insensitive" },
            setName:   { equals: setName,   mode: "insensitive" },
            rarity:    rarity    ? { equals: rarity,    mode: "insensitive" } : undefined,
            condition: { equals: condition, mode: "insensitive" },
          },
          isOutlier: false,
          isStale:   false,
        },
        select:  { price: true },
        orderBy: { observedAt: "desc" },
        take:    50,
      });
      priceCache.set(k, prices.map((p) => p.price));
    }),
  );

  // ── Build enriched response ────────────────────────────────────────────────
  const items = runs.map((run) => {
    const price = run.normalizedPrice ?? run.rawPrice;
    let medianWarning: "low" | "high" | null = null;
    let medianRatio:   number | null = null;
    let medianValue:   number | null = null;

    if (price != null && run.cardName && run.condition) {
      const existingPrices = priceCache.get(key(run)) ?? [];
      const dev = computeMedianDeviation(price, existingPrices);
      medianWarning = dev.warning;
      medianRatio   = dev.ratio   != null ? Math.round(dev.ratio * 100) / 100 : null;
      medianValue   = dev.median;
    }

    return {
      ...run,
      // Dates need to be serializable
      importedAt: run.importedAt?.toISOString() ?? null,
      createdAt:  run.createdAt.toISOString(),
      medianWarning,
      medianRatio,
      medianValue,
    };
  });

  return NextResponse.json({ ok: true, items });
}
