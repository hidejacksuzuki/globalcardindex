/**
 * POST /api/v1/card-requests/[id]/convert
 *
 * Admin: Convert an approved card request into a real Card record.
 *
 * Body (JSON, all optional overrides):
 *   { setName?: string, rarity?: string, condition?: string, game?: string }
 *
 * Behaviour:
 *   - Creates a Card using request data (+ overrides from body)
 *   - Generates a unique slug
 *   - Marks the CardRequest as "added" + sets reviewedAt
 *   - Returns { ok: true, cardId }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual, slugify }  from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

/** Generate a unique slug, appending -2, -3, ... on collision */
async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || "card";
  const existing  = await prisma.card.findUnique({ where: { slug: candidate }, select: { id: true } });
  if (!existing) return candidate;
  let n = 2;
  while (true) {
    const s = `${candidate}-${n}`;
    const ex = await prisma.card.findUnique({ where: { slug: s }, select: { id: true } });
    if (!ex) return s;
    n++;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Load the request
  const cardReq = await prisma.cardRequest.findUnique({ where: { id } });
  if (!cardReq) {
    return NextResponse.json({ ok: false, error: "request not found" }, { status: 404 });
  }

  // Body overrides
  let body: Record<string, string> = {};
  try {
    const raw = await req.json() as unknown;
    if (typeof raw === "object" && raw !== null) body = raw as Record<string, string>;
  } catch { /* no body is fine */ }

  const name      = cardReq.name;
  const setName   = body.setName   || cardReq.setName  || "Unknown Set";
  const rarity    = body.rarity    || cardReq.rarity   || "Unknown";
  const condition = body.condition || "NM";
  const game      = body.game      || cardReq.game      || null;

  // Generate slug
  const slugBase = [name, setName, rarity, condition]
    .map(slugify)
    .filter(Boolean)
    .join("-");
  const slug = await uniqueSlug(slugBase);

  try {
    const card = await prisma.card.create({
      data: { name, setName, rarity, condition, game, slug },
      select: { id: true, name: true, slug: true },
    });

    // Mark request as added
    await prisma.cardRequest.update({
      where: { id },
      data:  { status: "added", reviewedAt: new Date() },
    });

    return NextResponse.json({ ok: true, cardId: card.id, slug: card.slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Unique constraint = card already exists
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ ok: false, error: "card already exists with these attributes" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
