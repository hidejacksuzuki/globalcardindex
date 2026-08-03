/**
 * /feed.xml  — RSS 2.0 フィード
 *
 * Daily Recap アーカイブを RSS で配信。
 * RSS は「配信の背骨」として Discord / newsletter / 外部連携に使い回せる。
 *
 * 仕様:
 *   - アイテム: 最新 30 件の DailyRecapSnapshot
 *   - キャッシュ: 1 時間（ISR と揃える）
 *   - Content-Type: application/rss+xml; charset=utf-8
 *
 * 将来の拡張:
 *   /feed.xml?game=pokemon  — ゲーム別フィルタ
 *   /feed/gainers.xml        — Gainers 専用フィード
 */

import { NextResponse }            from "next/server";
import { getRecentRecapDates, getDailyRecapByDate } from "@gci/core";
import { getGame }                 from "@gci/core";

export const dynamic   = "force-dynamic";
export const revalidate = 3600;  // 1h キャッシュ

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "https://www.gci-index.com";
const FEED_URL  = `${BASE_URL}/feed.xml`;
const MAX_ITEMS = 30;

// ----------------------------------------------------------------
// XML エスケープ
// ----------------------------------------------------------------

function esc(str: string): string {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");
}

// ----------------------------------------------------------------
// RSS アイテム構築
// ----------------------------------------------------------------

function rssDate(isoOrDate: string | Date): string {
  return new Date(isoOrDate).toUTCString();
}

function buildItemDescription(
  recap: Awaited<ReturnType<typeof getDailyRecapByDate>>,
): string {
  if (!recap) return "";

  const parts: string[] = [];

  // 指数
  if (recap.index) {
    const c    = recap.index.change24h ?? recap.index.changeRate;
    const sign = c > 0 ? "+" : "";
    parts.push(`GCI Index: ${sign}${c.toFixed(2)}%`);
  }

  // Top Gainer
  if (recap.gainers.length > 0) {
    const g   = recap.gainers[0];
    const pct = g.change7d !== null ? ` (+${g.change7d.toFixed(1)}%)` : "";
    const game = g.game ? getGame(g.game) : null;
    const gameStr = game ? `${game.emoji} ` : "";
    parts.push(`▲ Top Gainer: ${gameStr}${g.cardName} (${g.setName})${pct}`);
  }

  // Top Loser
  if (recap.losers.length > 0) {
    const l   = recap.losers[0];
    const pct = l.change7d !== null ? ` (${l.change7d.toFixed(1)}%)` : "";
    const game = l.game ? getGame(l.game) : null;
    const gameStr = game ? `${game.emoji} ` : "";
    parts.push(`▼ Top Loser: ${gameStr}${l.cardName} (${l.setName})${pct}`);
  }

  // Volume Spike
  if (recap.spikes.length > 0) {
    const s = recap.spikes[0];
    parts.push(`⚡ Volume Spike: ${s.cardName} — ${s.count24h} listings/24h`);
  }

  // Editor note (先頭 120 文字)
  if (recap.editorNote) {
    parts.push("");
    parts.push(recap.editorNote.slice(0, 120) + (recap.editorNote.length > 120 ? "…" : ""));
  }

  return esc(parts.join("\n"));
}

function buildItemTitle(
  date: string,
  recap: Awaited<ReturnType<typeof getDailyRecapByDate>>,
): string {
  if (!recap) return esc(`Daily Recap — ${date}`);

  const gainer = recap.gainers[0];
  const index  = recap.index;

  const parts: string[] = [`GCI Daily — ${date}`];

  if (gainer && gainer.change7d !== null) {
    parts.push(`▲ ${gainer.cardName} +${gainer.change7d.toFixed(1)}%`);
  }
  if (index) {
    const c    = index.change24h ?? index.changeRate;
    const sign = c > 0 ? "+" : "";
    parts.push(`Index ${sign}${c.toFixed(2)}%`);
  }

  return esc(parts.join(" | "));
}

// ----------------------------------------------------------------
// Route Handler
// ----------------------------------------------------------------

export async function GET() {
  // 最新 MAX_ITEMS 件の日付一覧を取得
  const dates = await getRecentRecapDates(MAX_ITEMS);

  // 各スナップショットを並列取得
  const recaps = await Promise.all(
    dates.map((d) => getDailyRecapByDate(d)),
  );

  // RSS アイテム XML を生成
  const items = dates
    .map((date, i) => {
      const recap = recaps[i];
      const link  = `${BASE_URL}/daily/${date}`;
      const title = buildItemTitle(date, recap);
      const desc  = buildItemDescription(recap);
      const pubDate = recap
        ? rssDate(recap.generatedAt)
        : rssDate(`${date}T09:00:00+09:00`);

      return `
    <item>
      <title>${title}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      <category>Market Data</category>
    </item>`;
    })
    .join("\n");

  const now = new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
>
  <channel>
    <title>Global Card Index — Daily Market Recap</title>
    <link>${esc(BASE_URL)}</link>
    <atom:link href="${esc(FEED_URL)}" rel="self" type="application/rss+xml"/>
    <description>トレカ市場の日次まとめ。高騰・暴落・出品急増・指数変動を毎朝配信。</description>
    <language>ja</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    <copyright>© ${new Date().getFullYear()} Global Card Index</copyright>
    <image>
      <url>${esc(BASE_URL)}/og-image.png</url>
      <title>Global Card Index</title>
      <link>${esc(BASE_URL)}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type":  "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
