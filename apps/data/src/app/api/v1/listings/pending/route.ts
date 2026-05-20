/**
 * GET /api/v1/listings/pending?cardId=xxx
 *
 * Returns pending RawListings for a card (for the collect admin page).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cardId = new URL(req.url).searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json({ ok: false, error: "cardId required" }, { status: 400 });
  }

  const source = new URL(req.url).searchParams.get("source");

  const includeRejected = new URL(req.url).searchParams.get("includeRejected") === "1";

  // Yahoo Auction sources → query RawAuctionResult
  if (source === "yahoo_auction_active" || source === "yahoo_auction_closed") {
    const listings = await prisma.rawAuctionResult.findMany({
      where:   {
        cardId,
        source,
        status: includeRejected ? { in: ["pending", "rejected"] } : "pending",
      },
      orderBy: { matchScore: "desc" },
      select:  { id: true, title: true, price: true, url: true, bidCount: true, endedAt: true, matchScore: true, trustScore: true, status: true, capturedAt: true },
    });
    return NextResponse.json({ ok: true, listings });
  }

  const listings = await prisma.rawListing.findMany({
    where:   {
      cardId,
      status: includeRejected ? { in: ["pending", "rejected"] } : "pending",
    },
    orderBy: { matchScore: "desc" },
    select:  { id: true, title: true, price: true, url: true, matchScore: true, trustScore: true, status: true, capturedAt: true },
  });

  return NextResponse.json({ ok: true, listings });
}
