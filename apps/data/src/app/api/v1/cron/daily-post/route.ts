import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, writeCronLog } from "@gci/core";
import {
  buildMorningTweetPreview,
  postTweet,
  uploadOGImageFromUrl,
  checkTwitterEnv,
  withUtm,
} from "@gci/core";
import {
  getDailyRecap,
  getDailyRecapByDate,
  saveDailyRecap,
  saveTweetResult,
  getSnapshotTweetStatus,
  getDailyUpdateStats,
  getTopGainers,
  getTopLosers,
} from "@gci/core";

export const dynamic = "force-dynamic";

/**
 * Daily Recap X 自動投稿 Cron
 *
 * モード（クエリパラメータで選択）:
 *   ?dry=1     … ツイートテキストのみ返す、投稿なし（デフォルト）
 *   ?preview=1 … テキスト + 文字数 + 投稿前チェック結果を返す
 *   (なし)     … 実際に投稿する
 *
 * オプション:
 *   ?date=2026-05-09  … 指定日の recap を投稿（再投稿・手動トリガー用）
 *   ?media=1          … OG 画像をメディアとして添付（デフォルト: 有効）
 *   ?force=1          … 同日の既存 tweetId があっても再投稿する（慎重に）
 *
 * 使用例:
 *   # プレビュー確認
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-post?preview=1"
 *
 *   # 本日分を投稿（メディア付き）
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-post"
 *
 *   # 特定日を再投稿（dry-run）
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://your-app.vercel.app/api/v1/cron/daily-post?date=2026-05-09&dry=1"
 */
async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp      = req.nextUrl.searchParams;
  const isDry   = sp.get("dry") === "1";
  const isPreview = sp.get("preview") === "1";
  const withMedia = sp.get("media") !== "0";   // デフォルト有効
  const forcePost = sp.get("force") === "1";
  const dateParam = sp.get("date");             // "2026-05-09" 形式

  const start = Date.now();

  // ── 1. 環境変数チェック ──────────────────────────────────────
  if (!isDry && !isPreview) {
    const { ok, missing } = checkTwitterEnv();
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 },
      );
    }
  }

  // ── 2. Recap データ取得 ──────────────────────────────────────
  let recap;
  const targetDate = dateParam ?? new Date().toLocaleDateString("sv-SE");

  if (dateParam) {
    // 指定日: DB スナップショット優先、なければリアルタイム生成
    recap = await getDailyRecapByDate(dateParam);
    if (!recap) {
      recap = await getDailyRecap();
    }
  } else {
    // 当日: DB スナップショット優先
    recap = await getDailyRecapByDate(targetDate) ?? await getDailyRecap();
  }

  // ── 3. ツイートテキスト生成（"Today's Market" テンプレート） ─────
  const baseUrlForText = process.env.NEXT_PUBLIC_BASE_URL || "https://gci-index.com";
  const [gainersAll, losersAll, updateStats] = await Promise.all([
    getTopGainers(300),
    getTopLosers(300),
    getDailyUpdateStats(targetDate),
  ]);
  const preview = buildMorningTweetPreview({
    date:         targetDate,
    gainersCount: gainersAll.length,
    losersCount:  losersAll.length,
    updatedCount: updateStats.updatedCardsCount,
    url:          withUtm(`${baseUrlForText}/daily/${targetDate}`, "x-morning"),
  });

  if (isPreview) {
    return NextResponse.json({
      ok:          true,
      mode:        "preview",
      date:        targetDate,
      text:        preview.text,
      charCount:   preview.charCount,
      withinLimit: preview.withinLimit,
    });
  }

  if (isDry) {
    return NextResponse.json({
      ok:          true,
      mode:        "dry",
      date:        targetDate,
      text:        preview.text,
      charCount:   preview.charCount,
      withinLimit: preview.withinLimit,
    });
  }

  // ── 4. 重複投稿チェック（idempotency guard） ─────────────────
  if (!forcePost) {
    const status = await getSnapshotTweetStatus(targetDate);
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

  // ── 5. 文字数バリデーション ──────────────────────────────────
  if (!preview.withinLimit) {
    return NextResponse.json(
      {
        ok:    false,
        error: `Tweet exceeds 280 chars (got ${preview.charCount})`,
        text:  preview.text,
      },
      { status: 400 },
    );
  }

  // ── 6. OG 画像アップロード（オプション） ─────────────────────
  let mediaId: string | undefined;
  if (withMedia) {
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const imageUrl = `${baseUrl}/daily/${targetDate}/opengraph-image`;

    if (baseUrl) {
      console.log(`[daily-post] uploading media from ${imageUrl}`);
      const uploaded = await uploadOGImageFromUrl(imageUrl);
      if (uploaded) {
        mediaId = uploaded;
        console.log(`[daily-post] media_id: ${mediaId}`);
      } else {
        console.warn("[daily-post] media upload failed, falling back to text-only");
      }
    }
  }

  // ── 7. ツイート投稿（リトライ最大3回） ──────────────────────
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await postTweet(preview.text, mediaId);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[daily-post] attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        // 指数バックオフ: 1s, 2s
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  if (!result) {
    const ua2 = req.headers.get("user-agent") ?? "";
    const tBy = ua2.includes("vercel-cron") ? "cron" as const : "manual" as const;
    await writeCronLog("daily-post", "error", {
      durationMs: Date.now() - start, triggeredBy: tBy,
      errorMessage: lastError?.message ?? "unknown error after retries",
    });
    return NextResponse.json(
      {
        ok:      false,
        error:   lastError?.message ?? "unknown error",
        retries: MAX_RETRIES,
      },
      { status: 500 },
    );
  }

  // ── 8. 結果を DB に保存 ───────────────────────────────────────
  // スナップショットが DB にない場合は先に保存
  const existing = await getDailyRecapByDate(targetDate);
  if (!existing) {
    await saveDailyRecap(recap);
  }
  await saveTweetResult(targetDate, result.tweetId, result.url);

  const durationMs = Date.now() - start;
  const ua2 = req.headers.get("user-agent") ?? "";
  const tBy = ua2.includes("vercel-cron") ? "cron" as const : "manual" as const;
  await writeCronLog("daily-post", "ok", {
    durationMs, triggeredBy: tBy,
    result: { date: targetDate, tweetId: result.tweetId, withMedia: !!mediaId } as Record<string, unknown>,
  });

  return NextResponse.json({
    ok:         true,
    mode:       "posted",
    date:       targetDate,
    tweetId:    result.tweetId,
    tweetUrl:   result.url,
    withMedia:  !!mediaId,
    charCount:  preview.charCount,
    durationMs,
  });
}

export const GET  = handle;
export const POST = handle;
