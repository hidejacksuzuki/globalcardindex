/**
 * twitter.ts
 *
 * X (Twitter) API v2 クライアント。
 * OAuth 1.0a を Node.js 組み込み crypto のみで実装（外部ライブラリ不要）。
 *
 * 必要な環境変数（.env.example に追記）:
 *   TWITTER_API_KEY         — Consumer key  (Read and Write app)
 *   TWITTER_API_SECRET      — Consumer secret
 *   TWITTER_ACCESS_TOKEN    — Access token  (アカウント所有者の)
 *   TWITTER_ACCESS_SECRET   — Access token secret
 *   NEXT_PUBLIC_BASE_URL    — "https://globalcardindex.com"（OG画像取得に使用）
 */

import { createHmac, randomBytes } from "node:crypto";
import type { DailyRecap }         from "@/actions/recap";

// ----------------------------------------------------------------
// 型
// ----------------------------------------------------------------

export type TweetPreview = {
  text:        string;
  charCount:   number;           // Twitter の実効文字数（URL=23固定）
  withinLimit: boolean;          // <= 280
};

export type TweetResult = {
  tweetId: string;
  url:     string;               // https://x.com/i/web/status/{id}
};

// ----------------------------------------------------------------
// ツイートテキスト生成
//
// フォーマット:
//   📊 GCI Daily Recap — 2026/05/09
//
//   ▲ +38.2% リザードンex（SV4a）
//   ▼ -12.4% ミュウツーex（SV3a）
//   ⚡ 47 listings — ルフィ（OP-04）
//   📈 GCI Index +2.4%
//
//   https://globalcardindex.com/daily/2026-05-09
//
//   #ポケカ #トレカ相場 #GCI
// ----------------------------------------------------------------

const HASHTAGS = "#ポケカ #トレカ相場 #GCI";

const GAME_HASHTAG: Record<string, string> = {
  pokemon:  "#ポケカ",
  onepiece: "#ワンピカ",
  yugioh:   "#遊戯王",
  mtg:      "#MTG",
};

function gameTag(game: string | null): string {
  return game ? (GAME_HASHTAG[game] ?? "") : "";
}

/** ゲームが混在する場合も考慮したハッシュタグ行を生成 */
function buildHashtags(recap: DailyRecap): string {
  const games = new Set<string>();
  for (const c of [...recap.gainers, ...recap.losers]) {
    if (c.game) games.add(c.game);
  }
  const gameTags = [...games].slice(0, 2).map(gameTag).filter(Boolean).join(" ");
  return [gameTags, "#トレカ相場 #GCI"].filter(Boolean).join(" ");
}

export function buildTweetText(recap: DailyRecap): string {
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";
  const url      = `${baseUrl}/daily/${recap.date}`;
  const dateStr  = recap.date.replace(/-/g, "/");  // "2026/05/09"

  const lines: string[] = [];

  // ヘッダー
  lines.push(`📊 GCI Daily Recap — ${dateStr}`);
  lines.push("");

  // Top Gainer
  if (recap.gainers.length > 0) {
    const g = recap.gainers[0];
    const pct = g.change7d !== null ? `+${g.change7d.toFixed(1)}%` : "";
    const name = g.cardName.length > 20 ? g.cardName.slice(0, 18) + "…" : g.cardName;
    lines.push(`▲ ${pct} ${name}（${g.setName.slice(0, 12)}）`);
  }

  // Top Loser
  if (recap.losers.length > 0) {
    const l = recap.losers[0];
    const pct = l.change7d !== null ? `${l.change7d.toFixed(1)}%` : "";
    const name = l.cardName.length > 20 ? l.cardName.slice(0, 18) + "…" : l.cardName;
    lines.push(`▼ ${pct} ${name}（${l.setName.slice(0, 12)}）`);
  }

  // Volume Spike
  if (recap.spikes.length > 0) {
    const s = recap.spikes[0];
    const name = s.cardName.length > 16 ? s.cardName.slice(0, 14) + "…" : s.cardName;
    lines.push(`⚡ ${s.count24h} listings — ${name}`);
  }

  // 指数
  if (recap.index) {
    const change = recap.index.change24h ?? recap.index.changeRate;
    const sign   = change > 0 ? "+" : "";
    lines.push(`📈 GCI Index ${sign}${change.toFixed(2)}%`);
  }

  lines.push("");
  lines.push(url);
  lines.push("");
  lines.push(buildHashtags(recap));

  return lines.join("\n");
}

/**
 * ツイートプレビュー生成。
 * Twitter の URL 文字数カウント仕様:
 *   - URL は t.co で短縮され、常に 23 文字としてカウントされる
 *   - 日本語・絵文字は 1 文字としてカウント（コードポイント単位）
 */
export function buildTweetPreview(recap: DailyRecap): TweetPreview {
  const text     = buildTweetText(recap);
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";
  const url      = `${baseUrl}/daily/${recap.date}`;

  // URL を 23 文字に置換してカウント
  const countableText = text.replace(url, "X".repeat(23));
  const charCount     = [...countableText].length;   // コードポイント単位

  return { text, charCount, withinLimit: charCount <= 280 };
}

// ----------------------------------------------------------------
// OAuth 1.0a ヘルパー
// ----------------------------------------------------------------

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function buildOAuthHeader(
  method:    string,
  url:       string,
  extraParams: Record<string, string> = {},
): string {
  const apiKey       = process.env.TWITTER_API_KEY!;
  const apiSecret    = process.env.TWITTER_API_SECRET!;
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN!;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET!;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     apiKey,
    oauth_token:            accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_nonce:            randomBytes(16).toString("hex"),
    oauth_version:          "1.0",
  };

  // 署名対象パラメータ（OAuth + リクエストパラメータを結合・ソート）
  const allParams = { ...extraParams, ...oauthParams };
  const sortedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const sigBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join("&");

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  const signature  = createHmac("sha1", signingKey)
    .update(sigBaseString)
    .digest("base64");

  const headerParts = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const header = Object.entries(headerParts)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth ${header}`;
}

// ----------------------------------------------------------------
// メディアアップロード（Twitter v1.1 — シンプルモード）
//
// OG 画像（PNG）を Base64 エンコードして単一リクエストでアップロード。
// 5 MB 未満の静止画はシンプルモードで可。
// ----------------------------------------------------------------

const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

export async function uploadOGImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    // OG 画像を取得
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`image fetch failed: ${imgRes.status}`);

    const buffer   = Buffer.from(await imgRes.arrayBuffer());
    const b64data  = buffer.toString("base64");

    const body = new URLSearchParams({ media_data: b64data });

    const oauthHeader = buildOAuthHeader("POST", MEDIA_UPLOAD_URL);

    const res = await fetch(MEDIA_UPLOAD_URL, {
      method:  "POST",
      headers: {
        Authorization:  oauthHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`media upload failed ${res.status}: ${err}`);
    }

    const data = await res.json() as { media_id_string: string };
    return data.media_id_string;
  } catch (e) {
    console.error("[twitter] media upload error:", e);
    return null;  // メディア失敗はテキストのみで続行
  }
}

// ----------------------------------------------------------------
// ツイート投稿（API v2）
// ----------------------------------------------------------------

const TWEETS_URL = "https://api.twitter.com/2/tweets";

export async function postTweet(
  text:     string,
  mediaId?: string,
): Promise<TweetResult> {
  const body: Record<string, unknown> = { text };
  if (mediaId) body.media = { media_ids: [mediaId] };

  const oauthHeader = buildOAuthHeader("POST", TWEETS_URL);

  const res = await fetch(TWEETS_URL, {
    method:  "POST",
    headers: {
      Authorization:  oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`tweet failed ${res.status}: ${errText}`);
  }

  const data = await res.json() as { data: { id: string; text: string } };
  return {
    tweetId: data.data.id,
    url:     `https://x.com/i/web/status/${data.data.id}`,
  };
}

// ----------------------------------------------------------------
// 環境変数チェック
// ----------------------------------------------------------------

export function checkTwitterEnv(): { ok: boolean; missing: string[] } {
  const required = [
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}
