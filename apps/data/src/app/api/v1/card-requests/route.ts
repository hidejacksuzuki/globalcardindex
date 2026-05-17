/**
 * GET  /api/v1/card-requests   — list all requests (admin)
 * POST /api/v1/card-requests   — create a request (admin shortcut)
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status  = searchParams.get("status") ?? "pending";
  const limit   = Math.min(Number(searchParams.get("limit")  ?? "200"), 500);

  const requests = await prisma.cardRequest.findMany({
    where:   status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return NextResponse.json({ ok: true, requests });
}
