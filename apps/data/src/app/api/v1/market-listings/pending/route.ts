/**
 * GET /api/v1/market-listings/pending
 * RawMarketListing の一覧取得
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

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

  const sp     = new URL(req.url).searchParams;
  const cardId = sp.get("cardId") ?? undefined;
  const source = sp.get("source") ?? undefined;
  const status = sp.get("status") ?? "pending";
  const limit  = Math.min(parseInt(sp.get("limit") ?? "200", 10), 500);

  const listings = await prisma.rawMarketListing.findMany({
    where: {
      ...(cardId ? { cardId } : {}),
      ...(source ? { source } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: { capturedAt: "desc" },
    take:    limit,
    include: { card: { select: { name: true, rarity: true, setName: true } } },
  });

  return NextResponse.json({ ok: true, listings });
}
