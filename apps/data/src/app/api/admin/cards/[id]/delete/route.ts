/**
 * POST /api/admin/cards/:id/delete   — soft delete（deletedAt を設定）
 * POST /api/admin/cards/:id/restore  — 削除取り消し（deletedAt: null）
 *
 * Body: { restore?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id }     = await params;
  const body       = await req.json().catch(() => ({})) as { restore?: boolean };
  const isRestore  = body.restore === true;

  const card = await prisma.card.update({
    where: { id },
    data: isRestore
      ? { deletedAt: null, isVisible: true }
      : { deletedAt: new Date(), isVisible: false },
    select: { id: true, name: true, deletedAt: true, isVisible: true },
  }).catch(() => null);

  if (!card) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, card });
}
