/**
 * GET /api/admin/ebay/listings
 *
 * Query params:
 *   cardId  — filter by card
 *   status  — "pending" | "approved" | "rejected" | "imported" | "all"
 *   limit   — max results (default 100)
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
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const cardId = searchParams.get("cardId");
  const status = searchParams.get("status") ?? "pending";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  const listings = await prisma.ebayListing.findMany({
    where: {
      ...(cardId ? { cardId } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id:         true,
      title:      true,
      totalPrice: true,
      currency:   true,
      priceJpy:   true,
      matchScore: true,
      status:     true,
      soldAt:     true,
      listingUrl: true,
      cardId:     true,
      cardAliasId: true,
    },
  });

  return NextResponse.json({ ok: true, listings });
}
