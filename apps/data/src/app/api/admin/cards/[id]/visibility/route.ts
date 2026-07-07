/**
 * PATCH /api/admin/cards/:id/visibility
 * カードの表示/非表示を切り替える。
 * Body: { isVisible: boolean }
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
  return process.env.NODE_ENV !== "production";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id }        = await params;
  const { isVisible } = await req.json() as { isVisible: boolean };

  if (typeof isVisible !== "boolean") {
    return NextResponse.json({ ok: false, error: "isVisible (boolean) is required" }, { status: 400 });
  }

  const card = await prisma.card.update({
    where: { id },
    data:  { isVisible },
    select: { id: true, name: true, isVisible: true },
  }).catch(() => null);

  if (!card) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, card });
}
