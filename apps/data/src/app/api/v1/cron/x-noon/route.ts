import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, writeCronLog } from "@gci/core";
import {
  buildNoonTweetPreview,
  postTweet,
  checkTwitterEnv,
} from "@gci/core";
import {
  getDailyRecap,
  getDailyRecapByDate,
  saveDailyRecap,
  saveNoonTweetResult,
  getSnapshotNoonTweetStatus,
  getTopGainers,
} from "@gci/core";

export const dynamic = "force-dynamic";

/**
 * 昼 12:30 JST — "今日の急騰カード" X 自動投稿 Cron
 *
 * モード（クエリパラメータで選択）:
 *   ?dry=1     … ツイートテキストのみ返す、投稿なし（デフォルト）
 *   ?preview=1 … テキスト + 文字数 + 投稿前チェック結果を返す
 *   (なし)     … 実際に投稿する
 *
 * オプション:
 *   ?date=2026-07-05  … 指定日のスナップショットに紐付けて再投稿（手動トリガー用）
 *   ?force=1          … 同日の既存 tweetId があっても再投稿する（慎重に）
 */
async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp        = req.nextUrl.searchParams;
  const isDry     = sp.get("dry") === "1";
  const isPreview = sp.get("preview") === "1";
  const forcePost = sp.get("force") === "1";
  const dateParam = sp.get("date");

  const start       = Date.now();
  const targetDate  = dateParam ?? new Date().toLocaleDateString("sv-SE");
  const baseUrl     = process.env.NEXT_PUBLIC_BASE_URL || "https://gci-index.com";

  if (!isDry && !isPreview) {
    const { ok, missing } = checkTwitterEnv();
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 },
      );
    }
  }

  // ── 当日の急騰トップ1を取得 ──────────────────────────────────
  const [top] = await getTopGainers(1);

  if (!top || top.change7d === null) {
    await writeCronLog("x-noon", "ok", {
      durationMs: Date.now() - start,
      result: { skipped: true, reason: "no_gainer" },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "no_gainer" });
  }

  const url = top.slug ? `${baseUrl}/cards/${top.slug}` : `${baseUrl}/cards`;

  const preview = buildNoonTweetPreview({
    cardName:  top.cardName,
    changePct: top.change7d,
    price:     top.latestPrice,
    currency:  top.currency,
    url,
  });

  if (isPreview || isDry) {
    return NextResponse.json({
      ok:          true,
      mode:        isPreview ? "preview" : "dry",
      date:        targetDate,
      text:        preview.text,
      charCount:   preview.charCount,
      withinLimit: preview.withinLimit,
    });
  }

  // ── 重複投稿チェック ─────────────────────────────────────────
  if (!forcePost) {
    const status = await getSnapshotNoonTweetStatus(targetDate);
    if (status?.hasTweet) {
      return NextResponse.json({
        ok:       true,
        skipped:  true,
        reason:   "already_posted",
        date:     targetDate,
        tweetId:  status.tweetId,
        tweetUrl: status.tweetUrl,
      });
    }
  }

  if (!preview.withinLimit) {
    return NextResponse.json(
      { ok: false, error: `Tweet exceeds 280 chars (got ${preview.charCount})`, text: preview.text },
      { status: 400 },
    );
  }

  // ── 投稿（リトライ最大3回） ───────────────────────────────────
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await postTweet(preview.text);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[x-noon] attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  if (!result) {
    await writeCronLog("x-noon", "error", {
      durationMs: Date.now() - start,
      errorMessage: lastError?.message ?? "unknown error after retries",
    });
    return NextResponse.json(
      { ok: false, error: lastError?.message ?? "unknown error", retries: MAX_RETRIES },
      { status: 500 },
    );
  }

  // スナップショットが無ければ先に作る（idempotency フィールドの保存先確保）
  const existing = await getDailyRecapByDate(targetDate);
  if (!existing) {
    const recap = await getDailyRecap();
    await saveDailyRecap(recap);
  }
  await saveNoonTweetResult(targetDate, result.tweetId, result.url);

  const durationMs = Date.now() - start;
  await writeCronLog("x-noon", "ok", {
    durationMs,
    result: { date: targetDate, tweetId: result.tweetId, cardName: top.cardName },
  });

  return NextResponse.json({
    ok:        true,
    mode:      "posted",
    date:      targetDate,
    tweetId:   result.tweetId,
    tweetUrl:  result.url,
    charCount: preview.charCount,
    durationMs,
  });
}

export const GET  = handle;
export const POST = handle;
