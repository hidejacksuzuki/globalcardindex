import { NextRequest, NextResponse } from "next/server";
import { recalcIndex, type RecalcResult, authorizeCron, writeCronLog } from "@gci/core";
import type { ApiResponse } from "@gci/core";

export const dynamic    = "force-dynamic";
// カード数増加時の timeout 対策（Vercel Pro プラン上限に合わせる）
export const maxDuration = 300;

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
) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const startAt = Date.now();
  try {
    // User-Agent で Vercel Cron を識別（手動 curl は manual 扱い）
    const ua          = req.headers.get("user-agent") ?? "";
    const triggeredBy = ua.includes("vercel-cron") ? "cron" as const : "manual" as const;
    const result      = await recalcIndex(triggeredBy);
    const durationMs  = Date.now() - startAt;

    await writeCronLog("recalc", "ok", {
      durationMs, triggeredBy,
      result: result.saved
        ? {
            value:         result.value,
            sampleCount:   result.sampleCount,
            cardsUpdated:  result.cards.updated,
            cardsSkipped:  result.cards.skipped,
            cardsNoData:   result.cards.noData,
            cardsFailed:   result.cards.failed,
          }
        : { reason: result.reason },
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const ua = req.headers.get("user-agent") ?? "";
    const triggeredBy = ua.includes("vercel-cron") ? "cron" as const : "manual" as const;
    await writeCronLog("recalc", "error", {
      durationMs: Date.now() - startAt, triggeredBy, errorMessage: message });
    return NextResponse.json(
      { ok: false, error: message },
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
