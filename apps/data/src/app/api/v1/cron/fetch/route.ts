import { NextRequest, NextResponse } from "next/server";
import { markStalePrices, authorizeCron, writeCronLog, updatePrices } from "@gci/core";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro: 最大 300 秒

// ----------------------------------------------------------------
// Cron: fetch prices  — 10 分ごと
//
// 1. Yahoo オークション落札データをサーバーサイドで収集 (batchSize=10)
// 2. stale detection を実行（収集が止まったカードにフラグ）
//
// Auth: CRON_SECRET
// ----------------------------------------------------------------

async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const startAt     = Date.now();
  const isDry       = req.nextUrl.searchParams.get("dry") === "1";
  const batchSize   = Number(req.nextUrl.searchParams.get("batch") ?? "10");
  const ua          = req.headers.get("user-agent") ?? "";
  const triggeredBy = ua.includes("vercel-cron") ? "cron" as const : "manual" as const;

  try {
    // 1. Yahoo Auction 落札データ収集（サーバーサイド）
    const collectResult = await updatePrices({ batchSize, dryRun: isDry });

    // 2. stale detection
    const stale = await markStalePrices();

    const durationMs = Date.now() - startAt;
    await writeCronLog("fetch", "ok", {
      durationMs, triggeredBy, isDry,
      result: {
        collect: collectResult,
        stale:   { flagged: stale.flagged, unflagged: stale.unflagged },
      },
    });

    return NextResponse.json({
      ok:   true,
      data: { collect: collectResult, stale, ts: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await writeCronLog("fetch", "error", {
      durationMs: Date.now() - startAt, triggeredBy, isDry, errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET  = handle;
export const POST = handle;
