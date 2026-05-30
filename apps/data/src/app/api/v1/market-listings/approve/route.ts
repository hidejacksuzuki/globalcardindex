/**
 * POST /api/v1/market-listings/approve
 * RawMarketListing の承認 / 除外
 *
 * Body: { ids?: string[], reject?: string[] }
 * Response: { ok, approved, rejected }
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { ids?: string[]; reject?: string[] };
  const approveIds = body.ids    ?? [];
  const rejectIds  = body.reject ?? [];

  if (approveIds.length === 0 && rejectIds.length === 0) {
    return NextResponse.json({ ok: false, error: "no ids provided" }, { status: 400 });
  }

  const [approveResult, rejectResult] = await Promise.all([
    approveIds.length > 0
      ? prisma.rawMarketListing.updateMany({
          where: { id: { in: approveIds } },
          data:  { status: "approved" },
        })
      : Promise.resolve({ count: 0 }),
    rejectIds.length > 0
      ? prisma.rawMarketListing.updateMany({
          where: { id: { in: rejectIds } },
          data:  { status: "rejected" },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  // 承認済みの Price レコード作成
  if (approveIds.length > 0) {
    const approved = await prisma.rawMarketListing.findMany({
      where:  { id: { in: approveIds } },
      select: {
        id: true, cardId: true, price: true, source: true,
        endedAt: true, capturedAt: true, trustScore: true, url: true,
      },
    });

    await prisma.price.createMany({
      data: approved.map((r) => ({
        cardId:      r.cardId,
        price:       r.price,
        observedAt:  r.endedAt ?? r.capturedAt,
        sourceType:  r.source,
        sourceName:  r.source,
        fingerprint: `rml:${r.url ?? r.id}`,
        trustScore:  r.trustScore,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    ok:       true,
    approved: approveResult.count,
    rejected: rejectResult.count,
  });
}
