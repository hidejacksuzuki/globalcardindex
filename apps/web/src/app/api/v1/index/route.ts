import { NextRequest, NextResponse } from "next/server";
import { getLatestIndex, apiLimiter, getClientIp, rateLimitResponse } from "@gci/core";
import type { ApiResponse, IndexSnapshot } from "@gci/core";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<IndexSnapshot | null>>> {
  // ── Rate limiting ───────────────────────────────────────────────────────
  const _rl = apiLimiter.check(getClientIp(req.headers));
  if (!_rl.allowed) return rateLimitResponse(_rl, apiLimiter.max) as never;

  try {
    const data = await getLatestIndex();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
