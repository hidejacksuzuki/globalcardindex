import { NextRequest, NextResponse } from "next/server";
import { recalcIndex, type RecalcResult } from "@/jobs/recalcIndex";
import { authorizeCron }                  from "@/lib/auth/cronAuth";
import type { ApiResponse }               from "@/types";

export const dynamic = "force-dynamic";

/**
 * Cron entry point for `recalcIndex`.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this
 * automatically when CRON_SECRET is set in the project env). For manual
 * invocation, pass the same header. If CRON_SECRET is unset we allow
 * requests in non-production only, so local development still works.
 *
 * Both GET and POST are accepted — Vercel Cron uses GET; POST is
 * convenient for ad-hoc curl tests.
 */
async function handle(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<RecalcResult>>> {
  if (!authorizeCron(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    // User-Agent で Vercel Cron を識別（手動 curl は manual 扱い）
    const ua          = req.headers.get("user-agent") ?? "";
    const triggeredBy = ua.includes("vercel-cron") ? "cron" : "manual";
    const result      = await recalcIndex(triggeredBy);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
