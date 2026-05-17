import { NextRequest, NextResponse } from "next/server";
import { markStalePrices, authorizeCron, writeCronLog } from "@gci/core";
import type { ApiResponse } from "@gci/core";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// Cron: fetch prices  — 10 分ごと
//
// 現時点では Python worker / 外部コレクターが価格を
// POST /api/prices/bulk に送ってくる想定のため、
// この cron エンドポイントの主な役割は:
//   1. stale detection を実行（収集が止まったカードにフラグ）
//   2. 将来: コレクターキューを kick する
//
// Auth: CRON_SECRET（recalc と同一）
// ----------------------------------------------------------------

type FetchResult = {
  stale: { flagged: number; unflagged: number };
  ts:    string;
};

async function handle(
  req: NextRequest,
) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const startAt = Date.now();
  const isDry   = req.nextUrl.searchParams.get("dry") === "1";
  const ua      = req.headers.get("user-agent") ?? "";
  const triggeredBy = ua.includes("vercel-cron") ? "cron" as const : "manual" as const;

  try {
    // stale detection（capturedAt が 48 h 以上前のカードにフラグ）
    const stale = await markStalePrices();
    const durationMs = Date.now() - startAt;

    await writeCronLog("fetch", "ok", { durationMs, triggeredBy, isDry,
      result: { flagged: stale.flagged, unflagged: stale.unflagged } });

    return NextResponse.json({
      ok:   true,
      data: { stale, ts: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await writeCronLog("fetch", "error", {
      durationMs: Date.now() - startAt, triggeredBy, isDry, errorMessage: message });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export const GET  = handle;
export const POST = handle;
