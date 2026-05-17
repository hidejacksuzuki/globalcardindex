/**
 * GET /api/v1/card-requests/grouped
 *
 * Admin: requests grouped by (name, game) with count.
 * Useful for spotting popular requests and duplicates.
 *
 * Query params:
 *   status = "pending" | "all"  (default: "pending")
 *   limit  = number             (default: 100, max: 500)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
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
  const status = searchParams.get("status") ?? "pending";
  const limit  = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const grouped = await prisma.cardRequest.groupBy({
    by:      ["name", "game"],
    where:   status === "all" ? undefined : { status },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    limit,
  });

  // Fetch one representative row per (name, game) group for metadata
  const rows = await Promise.all(
    grouped.map(async (g) => {
      const sample = await prisma.cardRequest.findFirst({
        where:   {
          name: g.name,
          ...(g.game ? { game: g.game } : { game: null }),
          ...(status !== "all" ? { status } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, setName: true, game: true,
          rarity: true, status: true, createdAt: true,
        },
      });
      return {
        name:    g.name,
        game:    g.game,
        count:   g._count.id,
        sample,
      };
    }),
  );

  return NextResponse.json({ ok: true, groups: rows });
}
