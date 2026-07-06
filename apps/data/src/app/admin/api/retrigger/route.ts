/**
 * GET /admin/api/retrigger?channel=x|discord&date=YYYY-MM-DD&force=0|1
 *
 * Admin 画面からボタン一発で cron エンドポイントを呼び出すプロキシ。
 * CRON_SECRET をサーバー側で付与するため、ブラウザに秘密鍵を露出しない。
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CRON_PATHS: Record<string, string> = {
  "x":         "/api/v1/cron/daily-post",
  "x-noon":    "/api/v1/cron/x-noon",
  "x-evening": "/api/v1/cron/x-evening",
  "discord":   "/api/v1/cron/daily-discord",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel"); // "x" | "x-noon" | "x-evening" | "discord"
  const date    = searchParams.get("date");     // "YYYY-MM-DD"
  const force   = searchParams.get("force") === "1";

  if (!channel || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !CRON_PATHS[channel]) {
    return NextResponse.json({ ok: false, error: "invalid params" }, { status: 400 });
  }

  const secret  = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 500 });
  }

  // cron エンドポイントは data アプリ自身にある。
  // req.nextUrl.origin でリクエスト元と同じドメインを使う（環境変数不要）。
  const base = req.nextUrl.origin;
  const cronPath = CRON_PATHS[channel];

  const qs = new URLSearchParams({ date });
  if (force) qs.set("force", "1"); else qs.set("dry", "1");

  const url = `${base}${cronPath}?${qs.toString()}`;

  try {
    const res  = await fetch(url, {
      method:  "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
