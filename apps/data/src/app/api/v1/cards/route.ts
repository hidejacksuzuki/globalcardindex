/**
 * GET /api/v1/cards?limit=200&game=pokemon
 *
 * Returns card list for Chrome extension card selector.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

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

  const sp    = new URL(req.url).searchParams;
  const limit = Math.min(parseInt(sp.get("limit") ?? "200", 10), 500);
  const game  = sp.get("game") ?? undefined;

  const cards = await prisma.card.findMany({
    where:   game ? { game } : undefined,
    orderBy: [{ game: "asc" }, { name: "asc" }],
    take:    limit,
    select:  { id: true, name: true, rarity: true, setName: true, game: true },
  });

  return NextResponse.json({ ok: true, cards }, { headers: CORS_HEADERS });
}
