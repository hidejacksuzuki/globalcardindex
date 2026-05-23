/**
 * POST /api/v1/cron/backfill-prices
 *
 * 承認済み RawAuctionResult・RawListing から Price レコードを作成するバックフィル。
 * fingerprint で重複スキップするため何度実行しても安全。
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 1. 承認済み落札データ（Yahoo Auction）
  const approvedAuctions = await prisma.rawAuctionResult.findMany({
    where:  { source: "yahoo_auction_closed", status: "approved" },
    select: { id: true, cardId: true, price: true, endedAt: true, capturedAt: true },
  });

  const auctionResult = approvedAuctions.length > 0
    ? await prisma.price.createMany({
        data: approvedAuctions.map((r) => ({
          cardId:      r.cardId,
          price:       r.price,
          observedAt:  r.endedAt ?? r.capturedAt,
          sourceType:  "yahoo_auction_closed",
          sourceName:  "yahoo_auction",
          fingerprint: `rar:${r.id}`,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  // 2. 承認済みリスティングデータ（Mercari 等）
  const approvedListings = await prisma.rawListing.findMany({
    where:  { status: "approved" },
    select: { id: true, cardId: true, price: true, source: true, createdAt: true },
  });

  const listingResult = approvedListings.length > 0
    ? await prisma.price.createMany({
        data: approvedListings.map((r) => ({
          cardId:      r.cardId,
          price:       r.price,
          observedAt:  r.createdAt,
          sourceType:  r.source,
          sourceName:  r.source,
          fingerprint: `rl:${r.id}`,
        })),
        skipDuplicates: true,
      })
    : { count: 0 };

  return NextResponse.json({
    ok: true,
    auction:  { created: auctionResult.count,  total: approvedAuctions.length },
    listings: { created: listingResult.count,  total: approvedListings.length },
  });
}
