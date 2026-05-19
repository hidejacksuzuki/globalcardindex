/**
 * POST /api/v1/auction-listings/approve
 *
 * Approves or rejects RawAuctionResults, then creates a PriceSnapshot
 * from approved closed auction results (source = yahoo_auction_closed).
 *
 * Body: { ids: string[], reject?: string[] }
 * Response: { ok, approved, rejected, snapshot }
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { ids?: string[]; reject?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }

  const approveIds = body.ids    ?? [];
  const rejectIds  = body.reject ?? [];

  if (approveIds.length === 0 && rejectIds.length === 0) {
    return NextResponse.json({ ok: false, error: "no ids provided" }, { status: 400 });
  }

  const [approveResult, rejectResult] = await Promise.all([
    approveIds.length > 0
      ? prisma.rawAuctionResult.updateMany({ where: { id: { in: approveIds } }, data: { status: "approved" } })
      : Promise.resolve({ count: 0 }),
    rejectIds.length > 0
      ? prisma.rawAuctionResult.updateMany({ where: { id: { in: rejectIds } }, data: { status: "rejected" } })
      : Promise.resolve({ count: 0 }),
  ]);

  // Create PriceSnapshot from approved closed results only
  let snapshot = null;
  if (approveIds.length > 0) {
    const sample = await prisma.rawAuctionResult.findFirst({
      where:  { id: { in: approveIds } },
      select: { cardId: true, source: true },
    });

    if (sample && sample.source === "yahoo_auction_closed") {
      const approved = await prisma.rawAuctionResult.findMany({
        where:  { cardId: sample.cardId, source: "yahoo_auction_closed", status: "approved" },
        select: { price: true },
      });

      if (approved.length > 0) {
        const prices  = approved.map((l) => l.price);
        const sorted  = [...prices].sort((a, b) => a - b);
        const trimmed = sorted.slice(0, Math.ceil(sorted.length * 0.9));
        const avg     = Math.round(trimmed.reduce((s, p) => s + p, 0) / trimmed.length);

        snapshot = await prisma.priceSnapshot.create({
          data: {
            cardId:       sample.cardId,
            source:       "yahoo_auction_closed",
            minPrice:     sorted[0],
            medianPrice:  median(prices),
            avgPrice:     avg,
            maxPrice:     sorted[sorted.length - 1],
            sampleCount:  prices.length,
            approvedCount: approved.length,
          },
        });
      }
    }
  }

  return NextResponse.json({
    ok:       true,
    approved: approveResult.count,
    rejected: rejectResult.count,
    snapshot,
  });
}
