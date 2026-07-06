import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, writeCronLog } from "@gci/core";
import {
  buildEveningTweetPreview,
  postTweet,
  checkTwitterEnv,
} from "@gci/core";
import {
  getDailyRecap,
  getDailyRecapByDate,
  saveDailyRecap,
  saveEveningTweetResult,
  getSnapshotEveningTweetStatus,
  getDailyUpdateStats,
} from "@gci/core";

export const dynamic = "force-dynamic";

/**
 * 夜 20:30 JST — "今日の価格更新" X 自動投稿 Cron
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

  const start      = Date.now();
  const targetDate = dateParam ?? new Date().toLocaleDateString("sv-SE");
  const baseUrl    = process.env.NEXT_PUBLIC_BASE_URL || "https://gci-index.com";

  if (!isDry && !isPreview) {
    const { ok, missing } = checkTwitterEnv();
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 },
      );
    }
  }

  const stats = await getDailyUpdateStats(targetDate);

  const preview = buildEveningTweetPreview({
    updatedCount: stats.updatedCardsCount,
    newCount:     stats.newCardsCount,
    newCards:     stats.newCards,
    url:          `${baseUrl}/cards`,
  });

  if (isPreview || isDry) {
    return NextResponse.json({
      ok:          true,
      mode:        isPreview ? "preview" : "dry",
      date:        targetDate,
      text:        preview.text,
      charCount:   preview.charCount,
      withinLimit: preview.withinLimit,
      stats,
    });
  }

  if (!forcePost) {
    const status = await getSnapshotEveningTweetStatus(targetDate);
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

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await postTweet(preview.text);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[x-evening] attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  if (!result) {
    await writeCronLog("x-evening", "error", {
      durationMs: Date.now() - start,
      errorMessage: lastError?.message ?? "unknown error after retries",
    });
    return NextResponse.json(
      { ok: false, error: lastError?.message ?? "unknown error", retries: MAX_RETRIES },
      { status: 500 },
    );
  }

  const existing = await getDailyRecapByDate(targetDate);
  if (!existing) {
    const recap = await getDailyRecap();
    await saveDailyRecap(recap);
  }
  await saveEveningTweetResult(targetDate, result.tweetId, result.url);

  const durationMs = Date.now() - start;
  await writeCronLog("x-evening", "ok", {
    durationMs,
    result: {
      date:         targetDate,
      tweetId:      result.tweetId,
      updatedCount: stats.updatedCardsCount,
      newCount:     stats.newCardsCount,
    },
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
