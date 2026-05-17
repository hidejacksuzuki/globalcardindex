/**
 * GET /api/v1/card-requests/popular
 *
 * Public endpoint — returns the most-requested cards grouped by name.
 * Used by the /most-requested page.
 *
 * Query params:
 *   limit = number (default: 50, max: 100)
 *   game  = "pokemon" | "onepiece" | ... (optional filter)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const game  = searchParams.get("game") || undefined;

  const grouped = await prisma.cardRequest.groupBy({
    by:      ["name", "game"],
    where:   {
      status: "pending",
      ...(game ? { game } : {}),
    },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    limit,
  });

  const groups = grouped.map((g) => ({
    name:  g.name,
    game:  g.game,
    count: g._count.id,
  }));

  return NextResponse.json({ ok: true, groups });
}
