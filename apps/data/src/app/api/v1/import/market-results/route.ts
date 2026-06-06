/**
 * POST /api/v1/import/market-results
 *
 * 新統合インポートAPI。source に応じて RawMarketListing に保存。
 * scoreMarketListing() で自動スコアリング・自動承認。
 *
 * Body:
 *   { cardId, source, items: [{title, price, url?, imageUrl?, bidCount?, endedAt?}] }
 *
 * source: mercari_sold / mercari_listing / yahoo_auction_closed / yahoo_auction_active
 *
 * Response:
 *   { ok, saved, skipped, autoApproved, items }
 */

import { NextRequest, NextResponse }           from "next/server";
import { prisma }                              from "@gci/db";
import { timingSafeEqual, scoreMarketListing } from "@gci/core";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

const VALID_SOURCES = [
  "mercari_sold", "mercari_listing",
  "yahoo_auction_closed", "yahoo_auction_active",
];

type Item = {
  title:     string;
  price:     number;
  url?:      string;
  imageUrl?: string;
  bidCount?: number;
  endedAt?:  string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const body = await req.json() as { cardId?: string; source?: string; items?: Item[] };

  if (!body.cardId || !body.source || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { ok: false, error: "cardId, source, items[] required" },
      { status: 400 },
    );
  }

  if (!VALID_SOURCES.includes(body.source)) {
    return NextResponse.json(
      { ok: false, error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  const card = await prisma.card.findUnique({
    where:  { id: body.cardId },
    select: { id: true, name: true, rarity: true, setName: true, condition: true },
  });
  if (!card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  // 既存承認済みデータから中央値を取得
  const existing = await prisma.rawMarketListing.findMany({
    where:   { cardId: card.id, source: body.source, status: { in: ["approved", "auto_approved"] } },
    select:  { price: true },
    orderBy: { capturedAt: "desc" },
    take:    50,
  });
  const prices    = existing.map((e) => e.price).sort((a, b) => a - b);
  const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null;

  let saved = 0, skipped = 0, autoApproved = 0;
  const results: object[] = [];

  for (const item of body.items.slice(0, 200)) {
    if (!item.title || item.price == null) { skipped++; continue; }

    // URL 重複チェック
    if (item.url) {
      const dup = await prisma.rawMarketListing.findFirst({
        where:  { cardId: card.id, url: item.url },
        select: { id: true },
      });
      if (dup) { skipped++; continue; }
    }

    const { matchScore, trustScore, status } = scoreMarketListing(
      {
        title:    item.title,
        price:    item.price,
        source:   body.source,
        bidCount: item.bidCount,
        url:      item.url,
      },
      { name: card.name, rarity: card.rarity, setName: card.setName, condition: card.condition },
      medianPrice,
    );

    try {
      await prisma.rawMarketListing.create({
        data: {
          cardId:    card.id,
          source:    body.source,
          title:     item.title,
          price:     Math.round(item.price),
          url:       item.url    ?? null,
          imageUrl:  item.imageUrl ?? null,
          bidCount:  item.bidCount ?? null,
          endedAt:   item.endedAt ? new Date(item.endedAt) : null,
          matchScore,
          trustScore,
          status,
        },
      });

      // auto_approved → Price レコードも作成
      if (status === "auto_approved") {
        await prisma.price.create({
          data: {
            cardId:      card.id,
            price:       Math.round(item.price),
            observedAt:  item.endedAt ? new Date(item.endedAt) : new Date(),
            sourceType:  body.source,
            sourceName:  body.source,
            fingerprint: `rml:${item.url ?? `${card.id}:${item.title.slice(0, 30)}:${item.price}`}`,
            trustScore,
          },
        }).catch(() => undefined); // fingerprint 重複は無視

        autoApproved++;
      }

      saved++;
    } catch {
      skipped++;
    }

    results.push({ title: item.title, price: item.price, matchScore, trustScore, status });
  }

  return NextResponse.json(
    { ok: true, saved, skipped, autoApproved, items: results },
    { headers: CORS_HEADERS },
  );
}
