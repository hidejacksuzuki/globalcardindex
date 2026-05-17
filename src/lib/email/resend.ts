/**
 * resend.ts
 *
 * Resend API クライアント。
 * SDK を使わず fetch で直接叩く（外部依存ゼロ）。
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * 必要な環境変数（.env.example に追記）:
 *   RESEND_API_KEY    — Resend ダッシュボード → API Keys
 *   RESEND_FROM_EMAIL — 送信元アドレス（Resend で検証済みドメイン必須）
 *                       例: "GCI <noreply@globalcardindex.com>"
 *
 * 設計方針:
 *   - メールテンプレートはこのファイルにまとめる
 *   - HTML は最小構成（スパムフィルターに引っかかりにくい plain-text 近い HTML）
 *   - 全メールに List-Unsubscribe ヘッダーを付与（RFC 2369 / Gmail 推奨）
 */

import type { DailyRecap } from "@/actions/recap";

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type EmailPayload = {
  to:      string;
  subject: string;
  html:    string;
  text:    string;   // プレーンテキストフォールバック
  headers?: Record<string, string>;
};

export type SendResult = {
  id:    string;     // Resend message ID
  error: null;
} | {
  id:    null;
  error: string;
};

// ----------------------------------------------------------------
// 環境変数チェック
// ----------------------------------------------------------------

export function checkResendEnv(): { ok: boolean; missing: string[] } {
  const required = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];
  const missing  = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

// ----------------------------------------------------------------
// 送信コア
// ----------------------------------------------------------------

export async function sendEmail(payload: EmailPayload): Promise<SendResult> {
  const apiKey  = process.env.RESEND_API_KEY;
  const from    = process.env.RESEND_FROM_EMAIL ?? "GCI <noreply@globalcardindex.com>";

  if (!apiKey) return { id: null, error: "RESEND_API_KEY is not set" };

  const body = {
    from,
    to:      [payload.to],
    subject: payload.subject,
    html:    payload.html,
    text:    payload.text,
    headers: payload.headers ?? {},
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return { id: null, error: `Resend ${res.status}: ${err}` };
    }

    const data = await res.json() as { id: string };
    return { id: data.id, error: null };
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------
// メールテンプレート
// ----------------------------------------------------------------

// 共通スタイル（インライン CSS — メールクライアント対応）
const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #1a1a2e;
  max-width: 520px;
  margin: 0 auto;
  padding: 40px 24px;
`;

const LINK_STYLE = `
  color: #c8a84b;
  text-decoration: underline;
`;

const BUTTON_STYLE = `
  display: inline-block;
  background: #1a1a2e;
  color: #ffffff !important;
  text-decoration: none;
  padding: 12px 28px;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
`;

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f0;">
  <div style="${BASE_STYLE}">
    <p style="margin:0 0 24px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;">
      Global Card Index
    </p>
    ${content}
    <hr style="margin:32px 0;border:none;border-top:1px solid #e0e0d8;" />
    <p style="font-size:11px;color:#aaa;margin:0;">
      © ${new Date().getFullYear()} Global Card Index
    </p>
  </div>
</body>
</html>`;
}

// ── 確認メール（ダブルオプトイン） ──────────────────────────────

export function buildConfirmEmail(params: {
  email:       string;
  confirmUrl:  string;
  unsubUrl:    string;
}): EmailPayload {
  const { email, confirmUrl, unsubUrl } = params;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">
      購読を確認してください
    </h1>
    <p style="margin:0 0 24px;color:#555;">
      Global Card Index ニュースレターへの登録ありがとうございます。<br>
      下のボタンをクリックして、メールアドレスを確認してください。
    </p>
    <p style="margin:0 0 32px;">
      <a href="${confirmUrl}" style="${BUTTON_STYLE}">
        購読を確認する
      </a>
    </p>
    <p style="font-size:13px;color:#888;margin:0 0 8px;">
      ボタンが機能しない場合は以下の URL をブラウザに貼り付けてください：
    </p>
    <p style="font-size:12px;word-break:break-all;color:#aaa;margin:0 0 24px;">
      ${confirmUrl}
    </p>
    <p style="font-size:12px;color:#bbb;margin:0;">
      このメールに心当たりがない場合、何もしなければ登録は完了しません。<br>
      <a href="${unsubUrl}" style="${LINK_STYLE};font-size:12px;">登録を取り消す</a>
    </p>
  `);

  const text = [
    "Global Card Index ニュースレターへの登録を確認してください。",
    "",
    `確認 URL: ${confirmUrl}`,
    "",
    `心当たりがない場合は取り消し: ${unsubUrl}`,
  ].join("\n");

  return {
    to:      email,
    subject: "【GCI】ニュースレター購読の確認",
    html,
    text,
    headers: {
      "List-Unsubscribe":      `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ── 退会完了メール ───────────────────────────────────────────────

export function buildUnsubscribeEmail(params: {
  email: string;
}): EmailPayload {
  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">
      退会が完了しました
    </h1>
    <p style="margin:0 0 16px;color:#555;">
      ニュースレターの配信を停止しました。<br>
      これ以上メールは届きません。
    </p>
    <p style="font-size:13px;color:#888;margin:0;">
      再度購読するには
      <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com"}/newsletter"
         style="${LINK_STYLE}">こちら</a>
      から登録してください。
    </p>
  `);

  const text = [
    "GCI ニュースレターの退会が完了しました。",
    "再度購読: " + (process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com") + "/newsletter",
  ].join("\n");

  return {
    to:      params.email,
    subject: "【GCI】ニュースレター退会完了",
    html,
    text,
  };
}

// ── 日次ニュースレター本文 ───────────────────────────────────────

export function buildDailyNewsletterEmail(params: {
  to:       string;
  recap:    DailyRecap;
  unsubUrl: string;
  isTest?:  boolean;   // true → subject に [TEST] プレフィックス + HTML にバナー追加
}): EmailPayload {
  const { to, recap, unsubUrl, isTest = false } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";
  const dailyUrl = `${baseUrl}/daily/${recap.date}`;
  const dateStr  = recap.date.replace(/-/g, "/");

  const gainersHtml = recap.gainers.slice(0, 3).map((g) => {
    const pct = g.change7d !== null ? `+${g.change7d.toFixed(1)}%` : "";
    return `<tr>
      <td style="padding:6px 0;color:#1a1a2e;">${g.cardName}</td>
      <td style="padding:6px 0;color:#888;font-size:13px;">${g.setName}</td>
      <td style="padding:6px 0;color:#2ecc71;font-weight:600;text-align:right;">${pct}</td>
    </tr>`;
  }).join("");

  const losersHtml = recap.losers.slice(0, 3).map((l) => {
    const pct = l.change7d !== null ? `${l.change7d.toFixed(1)}%` : "";
    return `<tr>
      <td style="padding:6px 0;color:#1a1a2e;">${l.cardName}</td>
      <td style="padding:6px 0;color:#888;font-size:13px;">${l.setName}</td>
      <td style="padding:6px 0;color:#e74c3c;font-weight:600;text-align:right;">${pct}</td>
    </tr>`;
  }).join("");

  const indexStr = recap.index
    ? (() => {
        const c = recap.index.change24h ?? recap.index.changeRate;
        return `${c > 0 ? "+" : ""}${c.toFixed(2)}%`;
      })()
    : "—";

  const testBanner = isTest
    ? `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:3px;padding:10px 16px;margin-bottom:20px;font-size:12px;color:#856404;">
        ⚠️ <strong>TEST SEND</strong> — このメールはテスト送信です。実際の購読者には届いていません。
       </div>`
    : "";

  const html = emailWrapper(`
    ${testBanner}
    <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1a1a2e;">
      📊 GCI Daily Recap
    </h1>
    <p style="margin:0 0 24px;color:#888;font-size:14px;">${dateStr}</p>

    ${recap.index ? `
    <div style="background:#f0efe8;padding:16px 20px;border-radius:3px;margin-bottom:24px;">
      <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">GCI Index</span>
      <span style="margin-left:12px;font-size:22px;font-weight:700;color:${(recap.index.change24h ?? recap.index.changeRate) >= 0 ? "#2ecc71" : "#e74c3c"};">
        ${indexStr}
      </span>
    </div>
    ` : ""}

    ${gainersHtml ? `
    <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">
      ▲ Top Gainers (7D)
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      ${gainersHtml}
    </table>
    ` : ""}

    ${losersHtml ? `
    <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">
      ▼ Top Losers (7D)
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      ${losersHtml}
    </table>
    ` : ""}

    ${recap.editorNote ? `
    <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.7;border-left:3px solid #c8a84b;padding-left:16px;">
      ${recap.editorNote}
    </p>
    ` : ""}

    <p style="margin:0 0 32px;">
      <a href="${dailyUrl}" style="${BUTTON_STYLE}">
        詳細を見る →
      </a>
    </p>

    <p style="font-size:11px;color:#bbb;margin:0;">
      <a href="${unsubUrl}" style="color:#bbb;">配信停止</a>
      &nbsp;·&nbsp;
      <a href="${baseUrl}" style="color:#bbb;">globalcardindex.com</a>
    </p>
  `);

  const text = [
    `📊 GCI Daily Recap — ${dateStr}`,
    "",
    recap.index
      ? `GCI Index: ${indexStr}`
      : "",
    "",
    "▲ Top Gainers:",
    ...recap.gainers.slice(0, 3).map((g) =>
      `  ${g.cardName} (${g.setName}) ${g.change7d !== null ? `+${g.change7d.toFixed(1)}%` : ""}`
    ),
    "",
    "▼ Top Losers:",
    ...recap.losers.slice(0, 3).map((l) =>
      `  ${l.cardName} (${l.setName}) ${l.change7d !== null ? `${l.change7d.toFixed(1)}%` : ""}`
    ),
    "",
    recap.editorNote ?? "",
    "",
    `詳細: ${dailyUrl}`,
    "",
    `配信停止: ${unsubUrl}`,
  ].filter((l) => l !== undefined).join("\n");

  const subjectBase = `【GCI】${dateStr} 市場まとめ — ${indexStr} | ${recap.gainers[0]?.cardName ?? ""}`;

  return {
    to,
    subject: isTest ? `[TEST] ${subjectBase}` : subjectBase,
    html,
    text:    isTest ? `[TEST SEND]\n\n${text}` : text,
    headers: {
      "List-Unsubscribe":      `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
