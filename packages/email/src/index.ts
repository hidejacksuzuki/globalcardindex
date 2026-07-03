/**
 * @gci/email
 *
 * Resend API クライアント + メールテンプレート集。
 * SDK を使わず fetch で直接叩く（外部依存ゼロ）。
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * 必要な環境変数:
 *   RESEND_API_KEY    — Resend ダッシュボード → API Keys
 *   RESEND_FROM_EMAIL — 送信元アドレス（Resend で検証済みドメイン必須）
 *                       例: "GCI <noreply@globalcardindex.com>"
 */

// ----------------------------------------------------------------
// Minimal type stubs for DailyRecap (inlined to avoid circular dep
// with @gci/core, which imports @gci/email for newsletter actions).
// These must stay structurally compatible with the types in
// packages/core/src/actions/recap.ts and market.ts.
// ----------------------------------------------------------------

type _IndexSummary = {
  value:      number;
  change24h:  number | null;
  changeRate: number;
  updatedAt:  string;
};

type _MarketCard = {
  cardId:      string;
  slug:        string | null;
  cardName:    string;
  setName:     string;
  game:        string | null;
  rarity:      string;
  condition:   string;
  latestPrice: number | null;
  currency:    string | null;
  change7d:    number | null;
  change7dAbs: number | null;
  count24h:    number;
  count7d:     number;
  avgTrust:    number;
  trendScore:  number;
};

/** Structural alias — must match DailyRecap in @gci/core */
type DailyRecap = {
  date:        string;
  generatedAt: string;
  index:       _IndexSummary | null;
  gainers:     _MarketCard[];
  losers:      _MarketCard[];
  spikes:      _MarketCard[];
  trending:    _MarketCard[];
  editorNote:  string;
};

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type EmailPayload = {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
  headers?: Record<string, string>;
};

export type SendResult = {
  id:    string;
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
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL ?? "GCI <noreply@globalcardindex.com>";

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
// テンプレート共通スタイル
// ----------------------------------------------------------------

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

// ── マジックリンクメール（Auth.js / NextAuth sign-in） ───────────

/**
 * Auth.js の sendVerificationRequest から呼ばれる。
 * @param params.to       送信先メールアドレス
 * @param params.magicUrl ワンタイム sign-in URL
 */
export async function sendMagicLinkEmail(params: {
  to:       string;
  magicUrl: string;
}): Promise<void> {
  const { to, magicUrl } = params;

  const html = emailWrapper(`
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a1a2e;">
      GCI へようこそ
    </h1>
    <p style="margin:0 0 8px;color:#555;font-size:15px;">
      下のボタンからサインインしてください。
    </p>
    <p style="margin:0 0 32px;font-size:13px;color:#888;">
      このリンクは <strong style="color:#555;">10分間</strong> のみ有効です。
    </p>
    <p style="margin:0 0 32px;">
      <a href="${magicUrl}" style="${BUTTON_STYLE}">
        GCI にサインインする →
      </a>
    </p>
    <p style="font-size:13px;color:#999;margin:0 0 6px;">
      ボタンが機能しない場合は、以下の URL をブラウザに貼り付けてください:
    </p>
    <p style="font-size:12px;word-break:break-all;color:#bbb;margin:0 0 28px;line-height:1.6;">
      ${magicUrl}
    </p>
    <p style="font-size:12px;color:#ccc;margin:0;line-height:1.7;">
      このメールに心当たりがない場合は無視してください。<br>
      リンクをクリックしない限り、アカウントは作成されません。
    </p>
  `);

  const text = [
    "Global Card Index — サインインリンク",
    "",
    "以下の URL からサインインしてください（有効期限: 10分）:",
    "",
    magicUrl,
    "",
    "このメールに心当たりがない場合は無視してください。",
    "リンクをクリックしない限り、アカウントは作成されません。",
  ].join("\n");

  const payload: EmailPayload = {
    to,
    subject: "【GCI】サインインリンク",
    html,
    text,
  };

  // Auth.js は sendVerificationRequest が throw しない限り「送信成功」とみなし
  // /login/verify（メールを確認してください画面）へ進めてしまう。
  // 失敗を握りつぶすと「メールが来ない」症状の原因が闇に消えるため、必ず throw する。
  const result = await sendEmail(payload);
  if (result.error) {
    console.error(`[sendMagicLinkEmail] failed for ${to}: ${result.error}`);
    throw new Error(`Magic link email failed: ${result.error}`);
  }
}

// ── 確認メール（ダブルオプトイン） ──────────────────────────────

export function buildConfirmEmail(params: {
  email:      string;
  confirmUrl: string;
  unsubUrl:   string;
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
  to:      string;
  recap:   DailyRecap;
  unsubUrl: string;
  isTest?: boolean;
}): EmailPayload {
  const { to, recap, unsubUrl, isTest = false } = params;
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";
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
    recap.index ? `GCI Index: ${indexStr}` : "",
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

// ── 市場アラートメール（価格スパイク通知） ───────────────────────

export type AlertCard = {
  name:       string;
  setName:    string;
  rarity:     string;
  condition:  string;
  slug:       string | null;
  changeRate: number;   // %, signed (+/-15 以上が配信対象)
  value:      number;   // 最新指数値
};

export function buildMarketAlertEmail(params: {
  to:       string;
  cards:    AlertCard[];
  unsubUrl: string;
  date:     string;     // "2026-05-12"
}): EmailPayload {
  const { to, cards, unsubUrl, date } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

  const gainers = cards.filter((c) => c.changeRate >= 0).sort((a, b) => b.changeRate - a.changeRate);
  const losers  = cards.filter((c) => c.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate);

  function cardRow(c: AlertCard): string {
    const arrow    = c.changeRate >= 0 ? "▲" : "▼";
    const color    = c.changeRate >= 0 ? "#15803d" : "#dc2626";
    const pct      = `${arrow}${Math.abs(c.changeRate).toFixed(1)}%`;
    const cardUrl  = c.slug ? `${baseUrl}/cards/${c.slug}` : `${baseUrl}/cards`;
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0ea;">
          <a href="${cardUrl}" style="${LINK_STYLE};font-weight:600;">${c.name}</a>
          <span style="margin-left:6px;font-size:11px;color:#999;">${c.rarity} · ${c.condition}</span>
          <div style="font-size:11px;color:#aaa;margin-top:2px;">${c.setName}</div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0ea;text-align:right;font-weight:700;color:${color};white-space:nowrap;">
          ${pct}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0ea;text-align:right;color:#666;white-space:nowrap;">
          ${c.value.toFixed(1)}
        </td>
      </tr>`;
  }

  function section(title: string, emoji: string, rows: AlertCard[]): string {
    if (rows.length === 0) return "";
    return `
      <h2 style="margin:24px 0 8px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#1a1a2e;">
        ${emoji} ${title}
      </h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e8e8e0;">
        <thead>
          <tr style="background:#f5f5f0;">
            <th style="padding:6px 12px;text-align:left;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#999;">カード</th>
            <th style="padding:6px 12px;text-align:right;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#999;">変動</th>
            <th style="padding:6px 12px;text-align:right;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#999;">指数</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(cardRow).join("")}
        </tbody>
      </table>`;
  }

  const html = emailWrapper(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1a1a2e;">
      市場アラート
    </h1>
    <p style="margin:0 0 24px;font-size:13px;color:#888;">
      ${date} · 15%以上の価格変動を検知しました
    </p>
    ${section("急騰カード", "🔥", gainers)}
    ${section("急落カード", "📉", losers)}
    <p style="margin:24px 0 0;">
      <a href="${baseUrl}/trending" style="${BUTTON_STYLE}">
        市場トレンドを見る
      </a>
    </p>
    <hr style="margin:32px 0;border:none;border-top:1px solid #e0e0d8;" />
    <p style="font-size:11px;color:#bbb;margin:0;">
      <a href="${unsubUrl}" style="${LINK_STYLE};font-size:11px;">配信停止</a>
      &nbsp;·&nbsp;
      <a href="${baseUrl}/terms" style="${LINK_STYLE};font-size:11px;">免責事項</a>
    </p>
  `);

  const textLines = [
    `【GCI 市場アラート】${date}`,
    "",
    `15%以上の価格変動を検知しました。`,
    "",
  ];
  if (gainers.length > 0) {
    textLines.push("■ 急騰カード");
    gainers.forEach((c) => {
      textLines.push(`  ▲${c.changeRate.toFixed(1)}%  ${c.name} (${c.rarity})`);
    });
    textLines.push("");
  }
  if (losers.length > 0) {
    textLines.push("■ 急落カード");
    losers.forEach((c) => {
      textLines.push(`  ▼${Math.abs(c.changeRate).toFixed(1)}%  ${c.name} (${c.rarity})`);
    });
    textLines.push("");
  }
  textLines.push(`トレンドを確認: ${baseUrl}/trending`);
  textLines.push("");
  textLines.push(`配信停止: ${unsubUrl}`);

  return {
    to,
    subject: `【GCI アラート】${date} 急騰・急落カード ${cards.length} 件`,
    html,
    text:    textLines.join("\n"),
    headers: {
      "List-Unsubscribe":      `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ── 週次まとめメール（Weekly Recap） ─────────────────────────────

export type WeeklyRecapCard = {
  name:       string;
  setName:    string;
  rarity:     string;
  condition:  string;
  slug:       string | null;
  changeRate: number;
  value:      number;
};

export type WeeklyRecapData = {
  weekLabel:      string;    // "2026-W20"
  topGainers:     WeeklyRecapCard[];
  topLosers:      WeeklyRecapCard[];
  newCards:       { name: string; setName: string; rarity: string }[];
  confUpgrades:   { name: string; from: string; to: string }[];
  topRequested:   { name: string; game: string | null; count: number }[];
};

export function buildWeeklyRecapEmail(params: {
  to:       string;
  data:     WeeklyRecapData;
  unsubUrl: string;
}): EmailPayload {
  const { to, data, unsubUrl } = params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

  function cardItem(c: WeeklyRecapCard, sign: "up" | "down"): string {
    const color  = sign === "up" ? "#15803d" : "#dc2626";
    const prefix = sign === "up" ? "▲" : "▼";
    const url    = c.slug ? `${baseUrl}/cards/${c.slug}` : `${baseUrl}/cards`;
    return `<li style="padding:4px 0;border-bottom:1px solid #f0f0ea;">
      <a href="${url}" style="${LINK_STYLE}">${c.name}</a>
      <span style="color:#aaa;font-size:11px;"> · ${c.rarity}</span>
      <span style="color:${color};font-weight:700;float:right;">${prefix}${Math.abs(c.changeRate).toFixed(1)}%</span>
    </li>`;
  }

  const gainersHtml = data.topGainers.length > 0
    ? `<h2 style="margin:24px 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1a1a2e;">🔥 今週の急騰</h2>
       <ul style="margin:0;padding:0;list-style:none;">${data.topGainers.map((c) => cardItem(c, "up")).join("")}</ul>`
    : "";

  const losersHtml = data.topLosers.length > 0
    ? `<h2 style="margin:24px 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1a1a2e;">📉 今週の急落</h2>
       <ul style="margin:0;padding:0;list-style:none;">${data.topLosers.map((c) => cardItem(c, "down")).join("")}</ul>`
    : "";

  const newCardsHtml = data.newCards.length > 0
    ? `<h2 style="margin:24px 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1a1a2e;">✨ 新規追加カード</h2>
       <ul style="margin:0;padding:0 0 0 16px;color:#555;">
         ${data.newCards.map((c) => `<li style="padding:2px 0;">${c.name} <span style="color:#aaa;font-size:11px;">${c.rarity} · ${c.setName}</span></li>`).join("")}
       </ul>`
    : "";

  const requestedHtml = data.topRequested.length > 0
    ? `<h2 style="margin:24px 0 8px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#1a1a2e;">📋 注目リクエスト</h2>
       <ul style="margin:0;padding:0 0 0 16px;color:#555;">
         ${data.topRequested.slice(0, 5).map((r) => `<li style="padding:2px 0;">${r.name} <span style="color:#c8a84b;font-size:11px;">(${r.count}件)</span></li>`).join("")}
       </ul>
       <p style="margin:8px 0 0;font-size:12px;">
         <a href="${baseUrl}/most-requested" style="${LINK_STYLE}">すべてのリクエストを見る →</a>
       </p>`
    : "";

  const html = emailWrapper(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1a1a2e;">
      週次市場まとめ
    </h1>
    <p style="margin:0 0 24px;font-size:13px;color:#888;">
      ${data.weekLabel} · Global Card Index
    </p>
    ${gainersHtml}
    ${losersHtml}
    ${newCardsHtml}
    ${requestedHtml}
    <p style="margin:24px 0 0;">
      <a href="${baseUrl}/daily" style="${BUTTON_STYLE}">
        今日の市場まとめを見る
      </a>
    </p>
    <hr style="margin:32px 0;border:none;border-top:1px solid #e0e0d8;" />
    <p style="font-size:11px;color:#bbb;margin:0;">
      <a href="${unsubUrl}" style="${LINK_STYLE};font-size:11px;">配信停止</a>
    </p>
  `);

  const text = [
    `【GCI 週次まとめ】${data.weekLabel}`,
    "",
    data.topGainers.length > 0
      ? ["■ 今週の急騰", ...data.topGainers.map((c) => `  ▲${c.changeRate.toFixed(1)}% ${c.name}`), ""].join("\n")
      : "",
    data.topLosers.length > 0
      ? ["■ 今週の急落", ...data.topLosers.map((c) => `  ▼${Math.abs(c.changeRate).toFixed(1)}% ${c.name}`), ""].join("\n")
      : "",
    `${baseUrl}/daily`,
    "",
    `配信停止: ${unsubUrl}`,
  ].filter(Boolean).join("\n");

  return {
    to,
    subject: `【GCI】週次まとめ ${data.weekLabel}`,
    html,
    text,
    headers: {
      "List-Unsubscribe":      `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
