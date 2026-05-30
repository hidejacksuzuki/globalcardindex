/**
 * POST /api/v1/cards/candidates/[id]/approve
 * CardCandidate を承認して Card + SourceSearchUrl を作成する
 */

import { NextRequest, NextResponse }     from "next/server";
import { prisma }                        from "@gci/db";
import {
  timingSafeEqual,
  buildMercariSoldSearchUrl,
  buildMercariListingSearchUrl,
  buildYahooAuctionClosedSearchUrl,
  buildYahooAuctionActiveSearchUrl,
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

function makeSlug(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const candidate = await prisma.cardCandidate.findUnique({ where: { id: params.id } });
  if (!candidate) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // 呼び出し元から上書き可能
  const body = await req.json().catch(() => ({})) as {
    name?: string; setName?: string; game?: string; rarity?: string; condition?: string;
  };

  const name      = (body.name      ?? candidate.name).trim();
  const setName   = (body.setName   ?? candidate.version ?? "").trim();
  const game      = body.game      ?? candidate.game ?? null;
  const rarity    = (body.rarity    ?? candidate.rarity ?? "").trim();
  const condition = body.condition ?? candidate.condition;

  // slug 生成（衝突回避）
  const slugBase   = makeSlug([name, setName, rarity, condition]);
  const slugExists = await prisma.card.findUnique({ where: { slug: slugBase }, select: { id: true } });
  const slug       = slugExists ? `${slugBase}-${Date.now()}` : slugBase;

  // Card upsert
  const card = await prisma.card.upsert({
    where:  { name_setName_rarity_condition: { name, setName, rarity, condition } },
    update: { game: game ?? undefined },
    create: { name, setName, rarity, condition, game, slug },
  });

  const kw   = candidate.searchKeyword;
  const urls = [
    { source: "mercari_sold",         url: buildMercariSoldSearchUrl(kw)         },
    { source: "mercari_listing",      url: buildMercariListingSearchUrl(kw)      },
    { source: "yahoo_auction_closed", url: buildYahooAuctionClosedSearchUrl(kw)  },
    { source: "yahoo_auction_active", url: buildYahooAuctionActiveSearchUrl(kw)  },
  ];

  for (const { source, url } of urls) {
    await prisma.sourceSearchUrl.upsert({
      where:  { cardId_source: { cardId: card.id, source } },
      update: { url, keyword: kw, active: true },
      create: { cardId: card.id, source, url, keyword: kw, active: true },
    }).catch(() => undefined);
  }

  // Candidate を approved に
  await prisma.cardCandidate.update({
    where: { id: params.id },
    data:  { status: "approved" },
  });

  return NextResponse.json({ ok: true, card });
}
