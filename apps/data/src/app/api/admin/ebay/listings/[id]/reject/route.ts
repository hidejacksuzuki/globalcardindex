/**
 * POST /api/admin/ebay/listings/:id/reject
 * EbayListing を rejected に更新する。
 * Body: { reason?: string }
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

  const { id }   = await params;
  const body     = await req.json().catch(() => ({}) as { reason?: string });
  const reason   = typeof body.reason === "string" ? body.reason : undefined;

  const listing = await prisma.ebayListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  await prisma.ebayListing.update({
    where: { id },
    data:  { status: "rejected", rejectReason: reason },
  });

  return NextResponse.json({ ok: true });
}
