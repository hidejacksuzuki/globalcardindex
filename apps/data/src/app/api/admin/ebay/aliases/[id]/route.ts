/**
 * PATCH /api/admin/ebay/aliases/:id — CardAlias 更新
 * DELETE /api/admin/ebay/aliases/:id — CardAlias 削除
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
  return process.env.NODE_ENV !== "production";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body   = await req.json() as Partial<{
    locale:           string;
    name:             string;
    setName:          string;
    cardNumber:       string;
    rarity:           string;
    language:         string;
    market:           string;
    searchQuery:      string;
    negativeKeywords: string;
    isPrimary:        boolean;
    regenerateQuery:  boolean;  // true なら searchQuery を再生成
  }>;

  const current = await prisma.cardAlias.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  // searchQuery の再生成
  let searchQuery = body.searchQuery ?? current.searchQuery;
  if (body.regenerateQuery) {
    searchQuery = buildEbayQuery({
      name:       body.name       ?? current.name,
      setName:    body.setName    ?? current.setName,
      cardNumber: body.cardNumber ?? current.cardNumber,
      rarity:     body.rarity     ?? current.rarity,
      language:   body.language   ?? current.language,
    }).query;
  }

  const alias = await prisma.cardAlias.update({
    where: { id },
    data: {
      ...(body.locale           !== undefined && { locale:           body.locale           }),
      ...(body.name             !== undefined && { name:             body.name             }),
      ...(body.setName          !== undefined && { setName:          body.setName          }),
      ...(body.cardNumber       !== undefined && { cardNumber:       body.cardNumber       }),
      ...(body.rarity           !== undefined && { rarity:           body.rarity           }),
      ...(body.language         !== undefined && { language:         body.language         }),
      ...(body.market           !== undefined && { market:           body.market           }),
      ...(body.negativeKeywords !== undefined && { negativeKeywords: body.negativeKeywords }),
      ...(body.isPrimary        !== undefined && { isPrimary:        body.isPrimary        }),
      searchQuery,
    },
  });

  return NextResponse.json({ ok: true, alias });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.cardAlias.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
