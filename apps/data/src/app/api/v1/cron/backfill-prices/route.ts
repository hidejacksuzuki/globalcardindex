/**
 * POST /api/v1/cron/backfill-prices
 *
 * 承認済み RawAuctionResult から Price レコードを作成する一回限りのバックフィル。
 * fingerprint = "rar:{id}" で重複スキップするため何度実行しても安全。
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

  // 承認済み落札データを全件取得
  const approved = await prisma.rawAuctionResult.findMany({
    where:  { source: "yahoo_auction_closed", status: "approved" },
    select: { id: true, cardId: true, price: true, endedAt: true, capturedAt: true },
  });

  if (approved.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: "対象なし" });
  }

  const result = await prisma.price.createMany({
    data: approved.map((r) => ({
      cardId:      r.cardId,
      price:       r.price,
      observedAt:  r.endedAt ?? r.capturedAt,
      sourceType:  "yahoo_auction_closed",
      sourceName:  "yahoo_auction",
      fingerprint: `rar:${r.id}`,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, created: result.count, total: approved.length });
}
