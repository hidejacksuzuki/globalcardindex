/**
 * POST /api/admin/ebay/search
 *
 * CardAlias を指定して eBay Sold Listings を検索し、
 * EbayListing として pending 保存する。
 *
 * Body:
 *   { cardAliasId, listingType?, market?, limit? }
 *
 * Response:
 *   { ok, collectorRunId, listings: [...], totalFound }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import {
  timingSafeEqual,
  resolveSearchQuery,
  calculateEbayMatchScore,
  createEbayProviderFromEnv,
  convertToJpy,
  convertToUsd,
} from "@gci/core";

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
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    cardAliasId:  string;
    listingType?: "sold" | "active";
    market?:      "US" | "GLOBAL";
    limit?:       number;
  };

  if (!body.cardAliasId) {
    return NextResponse.json({ ok: false, error: "cardAliasId is required" }, { status: 400 });
  }

  const alias = await prisma.cardAlias.findUnique({
    where: { id: body.cardAliasId },
    include: { card: true },
  });

  if (!alias) {
    return NextResponse.json({ ok: false, error: "CardAlias not found" }, { status: 404 });
  }

  const { query, negativeKeywords } = resolveSearchQuery(alias);
  const listingType = body.listingType ?? "sold";
  const market      = body.market      ?? (alias.market as "US" | "GLOBAL");
  const limit       = body.limit       ?? 50;

  const provider = createEbayProviderFromEnv();

  let searchResult;
  try {
    searchResult = await provider.searchSoldListings({
      query,
      negativeKeywords,
      listingType,
      market,
      limit,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "search failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // matchScore 計算 + DB保存
  const created = await Promise.all(
    searchResult.listings.map(async (raw) => {
      const { score } = calculateEbayMatchScore({
        title:               raw.title,
        name:                alias.name,
        setName:             alias.setName,
        cardNumber:          alias.cardNumber,
        rarity:              alias.rarity,
        language:            alias.language,
        negativeKeywords:    alias.negativeKeywords,
        sellerFeedbackScore: raw.sellerFeedbackScore,
        hasSoldAt:           !!raw.soldAt,
      });

      const priceJpy = convertToJpy(raw.totalPrice, raw.currency);
      const priceUsd = convertToUsd(raw.totalPrice, raw.currency);

      return prisma.ebayListing.create({
        data: {
          cardId:              alias.cardId,
          cardAliasId:         alias.id,
          source:              "ebay",
          market,
          title:               raw.title,
          price:               raw.price,
          currency:            raw.currency,
          shippingPrice:       raw.shippingPrice,
          totalPrice:          raw.totalPrice,
          soldAt:              raw.soldAt ? new Date(raw.soldAt) : null,
          listingUrl:          raw.listingUrl,
          imageUrl:            raw.imageUrl,
          sellerName:          raw.sellerName,
          sellerFeedbackScore: raw.sellerFeedbackScore,
          listingType,
          conditionText:       raw.conditionText,
          matchScore:          score,
          status:              "pending",
          priceJpy:            priceJpy ?? undefined,
          priceUsd:            priceUsd ?? undefined,
          rawJson:             raw.rawJson ? (raw.rawJson as object) : undefined,
        },
      });
    })
  );

  return NextResponse.json({
    ok:          true,
    query,
    listings:    created.map((l) => ({
      id:           l.id,
      title:        l.title,
      price:        l.price,
      currency:     l.currency,
      shippingPrice: l.shippingPrice,
      totalPrice:   l.totalPrice,
      priceJpy:     l.priceJpy,
      soldAt:       l.soldAt,
      listingUrl:   l.listingUrl,
      imageUrl:     l.imageUrl,
      matchScore:   l.matchScore,
      status:       l.status,
    })),
    totalFound:  searchResult.totalFound,
  });
}
