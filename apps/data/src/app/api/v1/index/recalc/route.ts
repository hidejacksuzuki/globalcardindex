/**
 * POST /api/v1/index/recalc
 *
 * Triggers index recalculation.
 *   - No body / body `{}` → full recalc (global + all cards)
 *   - Body `{ cardId: "xxx" }` → single-card recalc only
 *
 * Auth: admin referer or CRON_SECRET Bearer token.
 *
 * Response:
 *   { ok: true, result: RecalcResult | CardRecalcEntry }
 */

import { NextRequest, NextResponse }   from "next/server";
import { recalcIndex, recalcCardIndex, timingSafeEqual } from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (
    secret.length >= 16 &&
    auth.startsWith("Bearer ") &&
    timingSafeEqual(auth.slice(7).trim(), secret)
  ) return true;

  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { cardId?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  try {
    if (body.cardId) {
      // Single-card recalc
      const entry = await recalcCardIndex(body.cardId, "manual");
      if (!entry) {
        return NextResponse.json(
          { ok: false, error: `card not found: ${body.cardId}` },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, result: entry });
    }

    // Full recalc (global + all cards)
    const result = await recalcIndex("manual");
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
