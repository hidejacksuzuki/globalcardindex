/**
 * POST /api/admin/ebay/listings/:id/import
 *
 * approved な EbayListing を Price レコードに変換して imported に更新。
 * trustScore は eBay Sold を 90 base として計算。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

const EBAY_SOLD_BASE_TRUST = 90;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  return process.env.NODE_ENV !== "production";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const listing = await prisma.ebayListing.findUnique({
    where: { id },
    include: { card: true, cardAlias: true },
  });

  if (!listing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (listing.status !== "approved") {
    return NextResponse.json({ ok: false, error: "listing must be approved before import" }, { status: 400 });
  }

  // TrustScore: eBay Sold base 90、matchScore が高いほど加点
  const trustBonus = Math.round((listing.matchScore / 100) * 10);
  const trustScore = Math.min(100, EBAY_SOLD_BASE_TRUST + trustBonus);

  // 価格は JPY 換算値を優先、なければ USD のまま
  const price = listing.priceJpy ?? listing.totalPrice;

  const fingerprint = `ebay:${listing.listingUrl ?? listing.id}`;

  // Price レコード作成
  const priceRecord = await prisma.price.create({
    data: {
      cardId:      listing.cardId,
      price,
      currency:    listing.priceJpy ? "JPY" : listing.currency,
      observedAt:  listing.soldAt   ?? listing.createdAt,
      sourceType:  "ebay",
      sourceName:  "ebay",
      listingType: "fixed",
      rawListingType: listing.listingType,
      availability: "sold",
      fingerprint,
      urlHash:     listing.listingUrl ? Buffer.from(listing.listingUrl).toString("base64").slice(0, 64) : null,
      trustScore,
      notes:       `market:${listing.market} currency:${listing.currency} matchScore:${listing.matchScore}`,
    },
  }).catch((err: { code?: string }) => {
    if (err?.code === "P2002") return null; // 重複 fingerprint は無視
    throw err;
  });

  // EbayListing を imported に更新
  await prisma.ebayListing.update({
    where: { id },
    data:  { status: "imported" },
  });

  return NextResponse.json({
    ok:         true,
    priceId:    priceRecord?.id ?? null,
    duplicate:  !priceRecord,
    trustScore,
  });
}
