import { NextRequest, NextResponse } from "next/server";
import { authorizeCron }              from "@/lib/auth/cronAuth";
import {
  buildDiscordPreview,
  postDiscordWebhook,
  checkDiscordEnv,
} from "@/lib/social/discord";
import {
  getDailyRecap,
  getDailyRecapByDate,
  saveDailyRecap,
  saveDiscordResult,
  getSnapshotDiscordStatus,
} from "@/actions/recap";

export const dynamic = "force-dynamic";

/**
 * Daily Recap Discord 自動投稿 Cron
 *
 * モード（クエリパラメータで選択）:
 *   ?dry=1     … Embed 内容のみ返す、投稿なし（デフォルト）
 *   ?preview=1 … Embed 内容 + フィールド数 + 投稿前チェックを返す
 *   (なし)     … 実際に投稿する
 *
 * オプション:
 *   ?date=2026-05-09  … 指定日の recap を投稿（再投稿・手動トリガー用）
 *   ?force=1          … 同日の既存 messageId があっても再投稿する（慎重に）
 *
 * 使用例:
 *   # プレビュー確認
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-discord?preview=1"
 *
 *   # 本日分を投稿
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-discord"
 *
 *   # 特定日を再投稿（dry-run）
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-discord?date=2026-05-09&dry=1"
 */
async function handle(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sp         = req.nextUrl.searchParams;
  const isDry      = sp.get("dry") === "1";
  const isPreview  = sp.get("preview") === "1";
  const forcePost  = sp.get("force") === "1";
  const dateParam  = sp.get("date");

  const start = Date.now();

  // ── 1. 環境変数チェック ──────────────────────────────────────
  if (!isDry && !isPreview) {
    const { ok, missing } = checkDiscordEnv();
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 },
      );
    }
  }

  // ── 2. Recap データ取得 ──────────────────────────────────────
  const targetDate = dateParam ?? new Date().toLocaleDateString("sv-SE");
  let recap;

  if (dateParam) {
    recap = await getDailyRecapByDate(dateParam);
    if (!recap) recap = await getDailyRecap();
  } else {
    recap = await getDailyRecapByDate(targetDate) ?? await getDailyRecap();
  }

  // ── 3. プレビュー生成 ────────────────────────────────────────
  const { embed, fieldCount } = buildDiscordPreview(recap);

  if (isPreview) {
    return NextResponse.json({
      ok:         true,
      mode:       "preview",
      date:       targetDate,
      embed,
      fieldCount,
    });
  }

  if (isDry) {
    return NextResponse.json({
      ok:         true,
      mode:       "dry",
      date:       targetDate,
      embed,
      fieldCount,
    });
  }

  // ── 4. 重複投稿チェック（idempotency guard） ─────────────────
  if (!forcePost) {
    const status = await getSnapshotDiscordStatus(targetDate);
    if (status?.hasPost) {
      return NextResponse.json({
        ok:        true,
        skipped:   true,
        reason:    "already_posted",
        date:      targetDate,
        messageId: status.messageId,
      });
    }
  }

  // ── 5. Webhook 送信（リトライ最大3回） ───────────────────────
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await postDiscordWebhook(recap);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(
        `[daily-discord] attempt ${attempt}/${MAX_RETRIES} failed:`,
        lastError.message,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  if (!result) {
    return NextResponse.json(
      {
        ok:      false,
        error:   lastError?.message ?? "unknown error",
        retries: MAX_RETRIES,
      },
      { status: 500 },
    );
  }

  // ── 6. 結果を DB に保存 ───────────────────────────────────────
  const existing = await getDailyRecapByDate(targetDate);
  if (!existing) {
    await saveDailyRecap(recap);
  }
  await saveDiscordResult(targetDate, result.messageId);

  const durationMs = Date.now() - start;

  return NextResponse.json({
    ok:         true,
    mode:       "posted",
    date:       targetDate,
    messageId:  result.messageId,
    fieldCount,
    durationMs,
  });
}

export const GET  = handle;
export const POST = handle;
