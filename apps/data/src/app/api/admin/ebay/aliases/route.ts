/**
 * GET  /api/admin/ebay/aliases  — CardAlias 一覧
 * POST /api/admin/ebay/aliases  — CardAlias 作成
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual, buildEbayQuery } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const cardId = searchParams.get("cardId");

  const aliases = await prisma.cardAlias.findMany({
    where:   cardId ? { cardId } : undefined,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    include: {
      card: { select: { id: true, name: true, setName: true, rarity: true, condition: true, game: true } },
      _count: { select: { ebayListings: true } },
    },
  });

  return NextResponse.json({ ok: true, aliases });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    cardId:            string;
    locale?:           string;
    name:              string;
    setName?:          string;
    cardNumber?:       string;
    rarity?:           string;
    language?:         string;
    market?:           string;
    searchQuery?:      string;
    negativeKeywords?: string;
    isPrimary?:        boolean;
  };

  if (!body.cardId || !body.name) {
    return NextResponse.json({ ok: false, error: "cardId and name are required" }, { status: 400 });
  }

  // searchQuery が未指定なら自動生成
  const searchQuery = body.searchQuery?.trim() ||
    buildEbayQuery({
      name:       body.name,
      setName:    body.setName,
      cardNumber: body.cardNumber,
      rarity:     body.rarity,
      language:   body.language,
    }).query;

  const alias = await prisma.cardAlias.create({
    data: {
      cardId:          body.cardId,
      locale:          body.locale           ?? "en",
      name:            body.name,
      setName:         body.setName,
      cardNumber:      body.cardNumber,
      rarity:          body.rarity,
      language:        body.language,
      market:          body.market           ?? "US",
      searchQuery,
      negativeKeywords: body.negativeKeywords ?? "PSA,BGS,CGC,graded,slab,proxy,custom,fan made,lot,bulk,sealed,booster,pack,box,case,digital,code",
      isPrimary:       body.isPrimary        ?? false,
    },
  });

  return NextResponse.json({ ok: true, alias });
}
