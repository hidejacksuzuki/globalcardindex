/**
 * GET /api/v1/cards?limit=200&game=pokemon&search=keyword
 *
 * Returns card list for Chrome extension card selector.
 * 認証不要（カード名・レアリティは非機密データ）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest): Promise<NextResponse> {

  const sp     = new URL(req.url).searchParams;
  const limit  = Math.min(parseInt(sp.get("limit") ?? "200", 10), 500);
  const game   = sp.get("game")   ?? undefined;
  const search = sp.get("search") ?? undefined;

  const cards = await prisma.card.findMany({
    where: {
      ...(game   ? { game }  : {}),
      ...(search ? {
        OR: [
          { name:    { contains: search, mode: "insensitive" } },
          { setName: { contains: search, mode: "insensitive" } },
          { rarity:  { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: [{ game: "asc" }, { name: "asc" }],
    take:    limit,
    select:  { id: true, name: true, rarity: true, setName: true, game: true },
  });

  return NextResponse.json({ ok: true, cards }, { headers: CORS_HEADERS });
}
