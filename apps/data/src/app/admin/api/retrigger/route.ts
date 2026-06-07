/**
 * GET /admin/api/retrigger?channel=x|discord&date=YYYY-MM-DD&force=0|1
 *
 * Admin 画面からボタン一発で cron エンドポイントを呼び出すプロキシ。
 * CRON_SECRET をサーバー側で付与するため、ブラウザに秘密鍵を露出しない。
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel"); // "x" | "discord"
  const date    = searchParams.get("date");     // "YYYY-MM-DD"
  const force   = searchParams.get("force") === "1";

  if (!channel || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "invalid params" }, { status: 400 });
  }

  const secret  = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 500 });
  }

  // cron エンドポイントは data アプリ自身にある。
  // VERCEL_URL は Vercel が自動設定する現デプロイの hostname（スキームなし）。
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.DATA_BASE_URL ?? "http://localhost:3001");
  const cronPath = channel === "x"
    ? `/api/v1/cron/daily-post`
    : `/api/v1/cron/daily-discord`;

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
