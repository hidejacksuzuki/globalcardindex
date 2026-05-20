/**
 * POST /api/v1/import/yahoo-auction
 *
 * Receives Yahoo Auction items (active or closed), scores them,
 * and saves as pending RawAuctionResults.
 *
 * Body:
 * {
 *   cardId: string,
 *   mode:   "active" | "closed",   // default: "closed"
 *   items: Array<{
 *     title:     string,
 *     price:     number,
 *     url?:      string,
 *     imageUrl?: string,
 *     bidCount?: number,
 *     endedAt?:  string,   // ISO datetime
 *   }>
 * }
 *
 * Response: { ok, saved, skipped, items }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { calcAuctionScore, autoVerdict, timingSafeEqual } from "@gci/core";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

type AuctionItem = {
  title:     string;
  price:     number;
  url?:      string;
  imageUrl?: string;
  bidCount?: number;
  endedAt?:  string;
};

type ImportBody = {
  cardId: string;
  mode?:  "active" | "closed";
  items:  AuctionItem[];
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: ImportBody;
  try {
    body = await req.json();
    if (!body.cardId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ ok: false, error: "cardId and items[] required" }, { status: 400 });
    }
    if (body.items.length > 200) {
      return NextResponse.json({ ok: false, error: "max 200 items" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const card = await prisma.card.findUnique({
    where:  { id: body.cardId },
    select: { id: true, name: true, rarity: true, setName: true },
  });
  if (!card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  const isClosed = (body.mode ?? "closed") === "closed";
  const source   = isClosed ? "yahoo_auction_closed" : "yahoo_auction_active";
  const results: object[] = [];
  let saved = 0, skipped = 0;

  for (const item of body.items) {
    if (!item.title || item.price == null) { skipped++; continue; }

    const { matchScore, trustScore } = calcAuctionScore(
      item.title,
      { name: card.name, rarity: card.rarity, setName: card.setName },
      isClosed,
      item.bidCount,
    );

    const verdict = autoVerdict(matchScore);

    try {
      await prisma.rawAuctionResult.create({
        data: {
          cardId:     card.id,
          source,
          title:      item.title,
          price:      Math.round(item.price),
          url:        item.url      ?? null,
          imageUrl:   item.imageUrl ?? null,
          bidCount:   item.bidCount ?? null,
          endedAt:    item.endedAt  ? new Date(item.endedAt) : null,
          matchScore,
          trustScore,
          status:     verdict === "rejected" ? "rejected" : "pending",
        },
      });
      saved++;
    } catch {
      skipped++;
    }

    results.push({
      title: item.title, price: item.price,
      bidCount: item.bidCount, matchScore, trustScore, verdict,
    });
  }

  return NextResponse.json({ ok: true, saved, skipped, items: results }, { headers: CORS_HEADERS });
}
