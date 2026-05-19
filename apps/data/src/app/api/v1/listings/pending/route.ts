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

  const listings = await prisma.rawListing.findMany({
    where:   { cardId, status: "pending" },
    orderBy: { matchScore: "desc" },
    select:  { id: true, title: true, price: true, url: true, matchScore: true, trustScore: true, status: true, capturedAt: true },
  });

  return NextResponse.json({ ok: true, listings });
}
