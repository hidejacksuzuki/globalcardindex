import { NextRequest, NextResponse } from "next/server";
import { getDailyRecap, saveDailyRecap } from "@/actions/recap";
import { authorizeCron }                  from "@/lib/auth/cronAuth";

export const dynamic = "force-dynamic";

/**
 * Daily Recap スナップショット保存 Cron
 *
 * スケジュール: 毎朝 9:00 JST (= 00:00 UTC)
 * vercel.json: { "path": "/api/v1/cron/daily-snapshot", "schedule": "0 0 * * *" }
 *
 * オプション:
 *   ?dry=1  … DB 保存をスキップして recap JSON のみ返す（動作確認用）
 *
 * 手動実行:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://your-app.vercel.app/api/v1/cron/daily-snapshot
 *
 *   # dry-run
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        "https://your-app.vercel.app/api/v1/cron/daily-snapshot?dry=1"
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const isDry = req.nextUrl.searchParams.get("dry") === "1";
  const start = Date.now();

  try {
    const recap = await getDailyRecap();

    if (!isDry) {
      await saveDailyRecap(recap);
    }

    const durationMs = Date.now() - start;

    return NextResponse.json({
      ok:      true,
      dry:     isDry,
      date:    recap.date,
      saved:   !isDry,
      stats: {
        gainers:     recap.gainers.length,
        losers:      recap.losers.length,
        spikes:      recap.spikes.length,
        trending:    recap.trending.length,
        indexValue:  recap.index?.value   ?? null,
        change24h:   recap.index?.change24h ?? null,
        durationMs,
      },
    });
  } catch (e) {
    console.error("[daily-snapshot] error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export const GET  = handle;
export const POST = handle;
