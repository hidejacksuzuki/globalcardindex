/**
 * POST /api/admin/ebay/listings/:id/approve
 * EbayListing を approved に更新する。
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const listing = await prisma.ebayListing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  await prisma.ebayListing.update({
    where: { id },
    data:  { status: "approved" },
  });

  return NextResponse.json({ ok: true });
}
