import { NextRequest, NextResponse } from "next/server";
import { markStalePrices } from "@/lib/engine/staleDetector";
import { authorizeCron }  from "@/lib/auth/cronAuth";
import type { ApiResponse } from "@/types";

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
): Promise<NextResponse<ApiResponse<FetchResult>>> {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // stale detection（capturedAt が 48 h 以上前のカードにフラグ）
    const stale = await markStalePrices();

    return NextResponse.json({
      ok:   true,
      data: { stale, ts: new Date().toISOString() },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

export const GET  = handle;
export const POST = handle;
