/**
 * discord.ts
 *
 * Discord Webhook クライアント。
 * OAuth 不要 — DISCORD_WEBHOOK_URL に POST するだけ。
 *
 * 必要な環境変数（.env.example に追記）:
 *   DISCORD_WEBHOOK_URL  — Discord サーバー設定 → 連携 → Webhook で取得
 *
 * 仕様:
 *   - Discord Embed でリッチな日次まとめを送信
 *   - 色: 指数↑ 緑 / 指数↓ 赤 / データなし グレー
 *   - ?wait=true で message.id を取得し DB に保存（idempotency guard）
 *
 * 将来の拡張:
 *   - スレッドへの投稿 (?thread_id=xxx)
 *   - ゲーム別 Webhook ルーティング
 */

import type { DailyRecap } from "../actions/recap";

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type DiscordEmbed = {
  title:       string;
  url:         string;
  description: string;
  color:       number;         // 0xRRGGBB
  fields:      DiscordField[];
  footer:      { text: string };
  timestamp:   string;         // ISO 8601
};

export type DiscordField = {
  name:   string;
  value:  string;
  inline: boolean;
};

export type DiscordWebhookPayload = {
  username?: string;
  embeds:    DiscordEmbed[];
};

export type DiscordPostResult = {
  messageId: string;
};

// ----------------------------------------------------------------
// Embed 構築
// ----------------------------------------------------------------

/** 指数方向に応じた Embed カラー */
function embedColor(recap: DailyRecap): number {
  if (!recap.index) return 0x95A5A6;  // グレー
  const change = recap.index.change24h ?? recap.index.changeRate;
  if (change > 0.1)  return 0x2ECC71;  // 緑
  if (change < -0.1) return 0xE74C3C;  // 赤
  return 0x95A5A6;                     // グレー（横ばい）
}

/** 日付文字列 "2026-05-09" → "2026/05/09" */
function fmtDate(date: string): string {
  return date.replace(/-/g, "/");
}

export function buildDiscordEmbed(recap: DailyRecap): DiscordEmbed {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";
  const url     = `${baseUrl}/daily/${recap.date}`;
  const fields: DiscordField[] = [];

  // ── GCI Index ──────────────────────────────────────────────────
  if (recap.index) {
    const change = recap.index.change24h ?? recap.index.changeRate;
    const sign   = change > 0 ? "+" : "";
    const arrow  = change > 0.1 ? "📈" : change < -0.1 ? "📉" : "➡️";
    fields.push({
      name:   "GCI Index",
      value:  `${arrow} **${sign}${change.toFixed(2)}%**`,
      inline: true,
    });
  }

  // ── Top Gainer ─────────────────────────────────────────────────
  if (recap.gainers.length > 0) {
    const g   = recap.gainers[0];
    const pct = g.change7d !== null ? ` **+${g.change7d.toFixed(1)}%**` : "";
    const set = g.setName.length > 14 ? g.setName.slice(0, 12) + "…" : g.setName;
    fields.push({
      name:   "▲ Top Gainer",
      value:  `${g.cardName}${pct}\n*${set}*`,
      inline: true,
    });
  }

  // ── Top Loser ──────────────────────────────────────────────────
  if (recap.losers.length > 0) {
    const l   = recap.losers[0];
    const pct = l.change7d !== null ? ` **${l.change7d.toFixed(1)}%**` : "";
    const set = l.setName.length > 14 ? l.setName.slice(0, 12) + "…" : l.setName;
    fields.push({
      name:   "▼ Top Loser",
      value:  `${l.cardName}${pct}\n*${set}*`,
      inline: true,
    });
  }

  // ── Volume Spike ───────────────────────────────────────────────
  if (recap.spikes.length > 0) {
    const s    = recap.spikes[0];
    const name = s.cardName.length > 18 ? s.cardName.slice(0, 16) + "…" : s.cardName;
    fields.push({
      name:   "⚡ Volume Spike",
      value:  `${name}\n*${s.count24h} listings / 24h*`,
      inline: true,
    });
  }

  // ── Trending ───────────────────────────────────────────────────
  if (recap.trending.length > 0) {
    const topTrend = recap.trending.slice(0, 3)
      .map((t, i) => `${i + 1}. ${t.cardName}`)
      .join("\n");
    fields.push({
      name:   "🔥 Trending",
      value:  topTrend,
      inline: false,
    });
  }

  // ── エディターノート ────────────────────────────────────────────
  const description = recap.editorNote
    ? recap.editorNote.slice(0, 250) + (recap.editorNote.length > 250 ? "…" : "")
    : "本日の市場まとめ。";

  return {
    title:       `📊 GCI Daily Recap — ${fmtDate(recap.date)}`,
    url,
    description,
    color:       embedColor(recap),
    fields,
    footer:      { text: "Global Card Index • globalcardindex.com" },
    timestamp:   recap.generatedAt,
  };
}

/** プレビュー用: Embed の内容をテキストで返す（投稿なし） */
export function buildDiscordPreview(recap: DailyRecap): {
  embed: DiscordEmbed;
  fieldCount: number;
} {
  const embed = buildDiscordEmbed(recap);
  return { embed, fieldCount: embed.fields.length };
}

// ----------------------------------------------------------------
// 環境変数チェック
// ----------------------------------------------------------------

export function checkDiscordEnv(): { ok: boolean; missing: string[] } {
  const required = ["DISCORD_WEBHOOK_URL"];
  const missing  = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

// ----------------------------------------------------------------
// Webhook 送信
//
// ?wait=true を付けることで Discord がメッセージオブジェクトを返す。
// message.id を DB に保存し、idempotency guard に利用。
// ----------------------------------------------------------------

export async function postDiscordWebhook(
  recap: DailyRecap,
): Promise<DiscordPostResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL is not set");

  const embed   = buildDiscordEmbed(recap);
  const payload: DiscordWebhookPayload = {
    username: "GCI Market Bot",
    embeds:   [embed],
  };

  // ?wait=true でメッセージオブジェクトを受け取る
  const url = webhookUrl.includes("?")
    ? `${webhookUrl}&wait=true`
    : `${webhookUrl}?wait=true`;

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discord webhook failed ${res.status}: ${errText}`);
  }

  const data = await res.json() as { id: string };
  return { messageId: data.id };
}
