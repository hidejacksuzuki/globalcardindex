/**
 * PATCH /api/v1/card-requests/[id]
 *
 * Admin: update a request status.
 *
 * Body: { status: "added" | "declined", reviewNote?: string }
 *
 * "added"    — card has been added to watchlist/DB
 * "declined" — request won't be actioned (out of scope, duplicate, etc.)
 * "pending"  — revert to pending
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET ?? "";
  const auth    = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;

  let body: { status?: string; reviewNote?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const allowed = ["pending", "added", "declined"];
  if (body.status && !allowed.includes(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
  }

  try {
    const updated = await prisma.cardRequest.update({
      where: { id },
      data: {
        ...(body.status    ? { status: body.status }                      : {}),
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote } : {}),
        ...(body.status && body.status !== "pending" ? { reviewedAt: new Date() } : {}),
      },
    });
    return NextResponse.json({ ok: true, request: updated });
  } catch {
    return NextResponse.json({ ok: false, error: "not found or update failed" }, { status: 404 });
  }
}
