/**
 * POST /api/v1/import/mercari
 *
 * Receives raw listing items (from paste UI or Chrome extension),
 * calculates matchScore/trustScore, and saves as pending RawListings.
 *
 * Auth: Bearer CRON_SECRET or admin referer
 *
 * Body:
 * {
 *   cardId: string,
 *   source: "mercari",
 *   items: Array<{
 *     title:    string,
 *     price:    number,
 *     url?:     string,
 *     imageUrl?: string,
 *   }>
 * }
 *
 * Response:
 * { ok, saved, skipped, items: [{ title, price, matchScore, trustScore, verdict }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { calcMatchScore, autoVerdict, timingSafeEqual } from "@gci/core";

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
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

type ImportItem = {
  title:     string;
  price:     number;
  url?:      string;
  imageUrl?: string;
};

type ImportBody = {
  cardId: string;
  source?: string;
  items:  ImportItem[];
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

  // Fetch card for scoring context
  const card = await prisma.card.findUnique({
    where:  { id: body.cardId },
    select: { id: true, name: true, rarity: true, setName: true },
  });
  if (!card) {
    return NextResponse.json({ ok: false, error: "card not found" }, { status: 404 });
  }

  const source = body.source ?? "mercari";
  const results: object[] = [];
  let saved = 0, skipped = 0;

  for (const item of body.items) {
    if (!item.title || item.price == null) { skipped++; continue; }

    const { matchScore, trustScore } = calcMatchScore(
      item.title,
      { name: card.name, rarity: card.rarity, setName: card.setName },
      item.price,
    );

    const verdict = autoVerdict(matchScore);

    const isAutoApprove = matchScore >= 75 && verdict !== "rejected";
    const status        = verdict === "rejected" ? "rejected" : isAutoApprove ? "approved" : "pending";

    try {
      await prisma.rawListing.create({
        data: {
          cardId:     card.id,
          source,
          title:      item.title,
          price:      Math.round(item.price),
          url:        item.url      ?? null,
          imageUrl:   item.imageUrl ?? null,
          matchScore,
          trustScore,
          status,
        },
      });

      // 高スコアは即座に Price レコードを作成
      if (isAutoApprove) {
        await prisma.price.create({
          data: {
            cardId:      card.id,
            price:       Math.round(item.price),
            observedAt:  new Date(),
            sourceType:  source,
            sourceName:  source,
            fingerprint: `ia:mc:${item.url ?? item.title.slice(0,40)}:${item.price}`,
          },
        }).catch(() => {});
      }

      saved++;
    } catch {
      skipped++;
    }

    results.push({ title: item.title, price: item.price, matchScore, trustScore, verdict });
  }

  return NextResponse.json({ ok: true, saved, skipped, items: results }, { headers: CORS_HEADERS });
}
