import { NextRequest, NextResponse }                          from "next/server";
import { authorizeCron, writeCronLog }                        from "@gci/core";
import { checkResendEnv, buildDailyNewsletterEmail, sendEmail } from "@gci/email";
import {
  getDailyRecap,
  getDailyRecapByDate,
}                                                             from "@gci/core";
import {
  getActiveSubscribers,
  getSubscriberStats,
  saveNewsletterRunLog,
}                                                             from "@gci/core";

export const dynamic = "force-dynamic";

/**
 * Daily Newsletter 配信 Cron
 *
 * モード（優先順位: test > preview > dry > live）:
 *   ?test=email@example.com
 *         … 指定メールにだけ送信（subject に [TEST]、active 購読者には送らない）
 *   ?dry=1
 *         … 購読者数・Recap サマリーを返す、送信なし（デフォルト・Vercel cron）
 *   ?preview=1
 *         … 先頭 1 件分のメール内容プレビュー、送信なし
 *   (なし)
 *         … SEND_ENABLED=true のときのみ全配信
 *
 * オプション:
 *   ?date=2026-05-09  … 指定日の recap を使用
 *   ?trigger=manual   … RunLog の triggeredBy を "manual" にする
 *
 * 実配信 ON にする前のチェックリスト:
 *   1. ?dry=1      → RunLog に記録されることを確認
 *   2. ?preview=1  → subject / HTML を確認
 *   3. ?test=your@email.com → 実際に受信、List-Unsubscribe 確認
 *   4. /admin/newsletter → RunLog で test_send が見えることを確認
 *   5. SEND_ENABLED = true に変更
 */

// 🔒 実配信ガード — Vercel 環境変数 NEWSLETTER_SEND_ENABLED="true" で ON
// デプロイなしで切り替えられる。デフォルトは false（安全側）。
const SEND_ENABLED = process.env.NEWSLETTER_SEND_ENABLED === "true";

// テスト送信で使う "仮の unsubscribe URL" のプレースホルダーシークレット
// active 購読者のトークンを使わず、テスト専用の固定パスを使う
const TEST_UNSUB_PLACEHOLDER = "test-send-no-real-token";

async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp          = req.nextUrl.searchParams;
  const testEmail   = sp.get("test")?.trim().toLowerCase() ?? null;
  const isDry       = sp.get("dry") === "1";
  const isPreview   = sp.get("preview") === "1";
  const dateParam   = sp.get("date");
  const triggeredBy = sp.get("trigger") === "manual" ? "manual" : "cron";

  const start = Date.now();

  // ── 安全ガード: 実配信はフラグが立つまで禁止 ────────────────────
  // test / dry / preview は SEND_ENABLED に関係なく通す
  if (!testEmail && !isDry && !isPreview && !SEND_ENABLED) {
    return NextResponse.json(
      {
        ok:    false,
        error: "実配信は無効です。SEND_ENABLED フラグを確認してください。",
        hint:  "順番: ?dry=1 → ?preview=1 → ?test=your@email.com → SEND_ENABLED=true",
      },
      { status: 400 },
    );
  }

  const targetDate = dateParam ?? new Date().toLocaleDateString("sv-SE");

  // ── Recap データ取得 ──────────────────────────────────────────
  const recap = await getDailyRecapByDate(targetDate) ?? await getDailyRecap();

  // ── ?test= モード ─────────────────────────────────────────────
  if (testEmail) {
    // 簡易バリデーション
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(testEmail)) {
      return NextResponse.json(
        { ok: false, error: "invalid test email address" },
        { status: 400 },
      );
    }

    // 環境変数チェック（test は実際に送信するので必須）
    const { ok: envOk, missing } = checkResendEnv();
    if (!envOk) {
      return NextResponse.json(
        { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 },
      );
    }

    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL || "https://globalcardindex.com";
    const unsubUrl = `${baseUrl}/newsletter/unsubscribe/${TEST_UNSUB_PLACEHOLDER}`;

    const emailPayload = buildDailyNewsletterEmail({
      to:      testEmail,
      recap,
      unsubUrl,
      isTest:  true,   // → subject に [TEST]、HTML にバナー追加
    });

    const result     = await sendEmail(emailPayload);
    const durationMs = Date.now() - start;

    // RunLog に記録（mode = "test_send"）
    await saveNewsletterRunLog({
      mode:        "test_send",
      date:        targetDate,
      status:      result.error ? "error" : "ok",
      totalTarget: 1,
      totalSent:   result.error ? 0 : 1,
      errorCount:  result.error ? 1 : 0,
      durationMs,
      note:        result.error
        ? `error: ${result.error}`
        : `sent to ${testEmail} resend_id=${result.id}`,
      triggeredBy: "manual",
    }).catch((e) => console.warn("[newsletter] run log save failed:", e));

    if (result.error) {
      await writeCronLog("daily-newsletter", "error", {
        durationMs, triggeredBy: "manual",
        errorMessage: `test_send failed: ${result.error}`,
      });
      return NextResponse.json(
        {
          ok:    false,
          mode:  "test_send",
          error: result.error,
          to:    testEmail,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok:        true,
      mode:      "test_send",
      date:      targetDate,
      to:        testEmail,
      subject:   emailPayload.subject,
      resendId:  result.id,
      durationMs,
      checklist: [
        "1. 受信トレイを確認（subject に [TEST] があることを確認）",
        "2. HTML レイアウトが崩れていないか確認",
        "3. List-Unsubscribe リンクがメールクライアントに表示されているか確認",
        "4. /admin/newsletter で RunLog に test_send が表示されることを確認",
        "5. 問題なければ SEND_ENABLED = true に変更して実配信 ON",
      ],
    });
  }

  // ── ?preview=1 モード ─────────────────────────────────────────
  if (isPreview) {
    const [subscribers, stats] = await Promise.all([
      getActiveSubscribers(),
      getSubscriberStats(),
    ]);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://globalcardindex.com";

    const emailPayload = subscribers.length > 0
      ? buildDailyNewsletterEmail({
          to:      subscribers[0].email,
          recap,
          unsubUrl: `${baseUrl}/newsletter/unsubscribe/${subscribers[0].token}`,
        })
      : null;

    return NextResponse.json({
      ok:    true,
      mode:  "preview",
      date:  targetDate,
      stats,
      email: emailPayload
        ? {
            to:            emailPayload.to,
            subject:       emailPayload.subject,
            charCountHtml: emailPayload.html.length,
            charCountText: emailPayload.text.length,
            textPreview:   emailPayload.text.slice(0, 600),
          }
        : null,
      note: subscribers.length === 0 ? "active 購読者がいません" : undefined,
    });
  }

  // ── ?dry=1 モード（+ Vercel cron のデフォルト呼び出し）────────
  const [subscribers, stats] = await Promise.all([
    getActiveSubscribers(),
    getSubscriberStats(),
  ]);
  const { ok: envOk, missing } = checkResendEnv();
  const durationMs = Date.now() - start;

  await saveNewsletterRunLog({
    mode:        "dry",
    date:        targetDate,
    status:      "ok",
    totalTarget: subscribers.length,
    totalSent:   0,
    errorCount:  0,
    durationMs,
    note:        `env_ready=${envOk}`,
    triggeredBy,
  }).catch((e) => console.warn("[newsletter] run log save failed:", e));

  await writeCronLog("daily-newsletter", "ok", {
    durationMs, triggeredBy, isDry: true,
    result: { date: targetDate, wouldSend: subscribers.length, envReady: envOk } as Record<string, unknown>,
  });

  return NextResponse.json({
    ok:   true,
    mode: "dry",
    date: targetDate,
    stats,
    recap: {
      date:          recap.date,
      gainers:       recap.gainers.length,
      losers:        recap.losers.length,
      spikes:        recap.spikes.length,
      hasIndex:      recap.index !== null,
      editorNoteLen: recap.editorNote.length,
    },
    resend: {
      envReady: envOk,
      missing:  envOk ? [] : missing,
    },
    wouldSend:  subscribers.length,
    durationMs,
    note: "実際の送信は行われていません。?preview=1 または ?test=your@email.com を使用してください。",
  });
}

export const GET  = handle;
export const POST = handle;
