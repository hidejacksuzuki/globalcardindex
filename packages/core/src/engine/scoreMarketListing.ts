/**
 * scoreMarketListing
 *
 * RawMarketListing のスコアリング。
 * matchScore: タイトルとカード情報の一致度 (0–100)
 * trustScore: ソース信頼性・品質 (0–100)
 * status:     "auto_approved" | "pending" | "rejected"
 *
 * 自動承認条件（すべて満たす場合のみ）:
 *   - source が mercari_sold または yahoo_auction_closed
 *   - matchScore >= 75
 *   - 除外ワードなし
 *   - price > 0
 *   - 価格が既存中央値の ±50% 以内（medianPrice が渡された場合）
 */

export type ScoreInput = {
  title:     string;
  price:     number;
  source:    string;
  bidCount?: number;
  url?:      string;
};

export type CardMeta = {
  name:       string;
  rarity:     string;
  setName:    string;
  condition?: string;
};

export type ScoreResult = {
  matchScore: number;
  trustScore: number;
  status:     "auto_approved" | "pending" | "rejected";
};

// 除外ワード（マッチしたら即減点）
const PENALTY_WORDS: { word: string; matchPenalty: number; trustPenalty: number }[] = [
  { word: "オリパ",       matchPenalty: -50, trustPenalty: -40 },
  { word: "引退品",       matchPenalty: -40, trustPenalty: -30 },
  { word: "まとめ",       matchPenalty: -40, trustPenalty: -30 },
  { word: "大量",         matchPenalty: -40, trustPenalty: -30 },
  { word: "セット",       matchPenalty: -30, trustPenalty: -20 },
  { word: "海外版",       matchPenalty: -30, trustPenalty: -20 },
  { word: "英語版",       matchPenalty: -30, trustPenalty: -20 },
  { word: "韓国語",       matchPenalty: -30, trustPenalty: -20 },
  { word: "中国語",       matchPenalty: -30, trustPenalty: -20 },
  { word: "傷あり",       matchPenalty: -30, trustPenalty: -20 },
  { word: "ジャンク",     matchPenalty: -50, trustPenalty: -40 },
  { word: "レプリカ",     matchPenalty: -80, trustPenalty: -60 },
  { word: "proxy",        matchPenalty: -30, trustPenalty: -25 },
  { word: "空箱",         matchPenalty: -80, trustPenalty: -60 },
  { word: "サプライのみ", matchPenalty: -80, trustPenalty: -60 },
];

/**
 * カード名がタイトルに含まれるか（別カード誤爆ガード付き）。
 * 「イーブイ」が「イーブイex」の出品に一致してしまう問題（2026-09-21 発見）への対策:
 * 名前の直後に ex / V / VMAX / VSTAR / GX が続く出現は「より長い別カード名」と
 * みなして数えない。すべての出現がそれに該当する場合のみ不一致とする。
 */
function nameInTitle(t: string, nameLower: string): boolean {
  let from = 0;
  for (;;) {
    const i = t.indexOf(nameLower, from);
    if (i === -1) return false;
    const after = t.slice(i + nameLower.length, i + nameLower.length + 5);
    // ex/GX/V/VMAX/VSTAR が直後に続く出現は別カード。名前が「…V」で終わる場合の
    // 「VMAX/VSTAR」出品（例: リザードンV vs リザードンVMAX）は max/star の続きで検出
    if (!/^(ex|ｅｘ|gx|max|star|v(max|star)?([^a-z]|$)|v$)/i.test(after)) return true;
    from = i + 1;
  }
}

/**
 * レアリティがタイトルに含まれるか。
 * 短い英字レアリティ（AR/SR/UR等）は前後に英字が続かない出現を要求する
 * （「SAR」の出品に「AR」が誤ヒットしていた問題への対策）。
 */
function rarityInTitle(t: string, rarityLower: string): boolean {
  if (!/^[a-z0-9]{1,4}$/.test(rarityLower)) return t.includes(rarityLower);
  const re = new RegExp(`(?<![a-z])${rarityLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`);
  return re.test(t);
}

export function scoreMarketListing(
  input:        ScoreInput,
  card:         CardMeta,
  medianPrice?: number | null,
): ScoreResult {
  const t = input.title.toLowerCase();

  // ── matchScore ───────────────────────────────────────────────────
  let match = 0;

  if (nameInTitle(t, card.name.toLowerCase()))           match += 40;
  if (card.rarity && rarityInTitle(t, card.rarity.toLowerCase()))  match += 25;
  if (card.setName && t.includes(card.setName.toLowerCase())) match += 20;

  // グレーディング条件チェック
  const cardIsGraded    = /^(PSA|BGS|ARS)\d/i.test(card.condition ?? "");
  const titleHasGrading = /psa|bgs|ars/i.test(t);

  if (cardIsGraded && titleHasGrading) {
    match += 20;
    // 同グレード一致でさらに加点
    const grade = (card.condition ?? "").toLowerCase().replace(/\s/g, "");
    if (t.replace(/\s/g, "").includes(grade)) match += 10;
  } else if (cardIsGraded && !titleHasGrading) {
    match -= 25; // グレーディングカードなのに非鑑定品
  } else if (!cardIsGraded && titleHasGrading) {
    match -= 25; // NM/rawカードに鑑定タグ混入
  }

  // 短いタイトル = 単品の可能性
  if (input.title.length < 60)                           match += 10;

  // 除外ワード減点
  let hasPenaltyWord = false;
  let matchPenaltyTotal = 0;
  let trustPenaltyTotal = 0;
  for (const { word, matchPenalty, trustPenalty } of PENALTY_WORDS) {
    if (t.includes(word.toLowerCase())) {
      hasPenaltyWord = true;
      matchPenaltyTotal += matchPenalty;
      trustPenaltyTotal += trustPenalty;
    }
  }
  match += matchPenaltyTotal;
  match = Math.max(0, Math.min(100, match));

  // ── trustScore ───────────────────────────────────────────────────
  let trust = 50; // base

  if (input.source === "mercari_sold" || input.source === "yahoo_auction_closed") trust += 20;
  else if (input.source === "mercari_listing") trust += 5;

  if ((input.bidCount ?? 0) > 0) trust += 10;
  if (input.url)                 trust += 5;

  trust += trustPenaltyTotal;
  trust = Math.max(0, Math.min(100, trust));

  // ── 価格範囲チェック ──────────────────────────────────────────────
  let priceOk = true;
  if (medianPrice && medianPrice > 0) {
    const ratio = input.price / medianPrice;
    if (ratio < 0.5 || ratio > 1.5) priceOk = false;
  }

  // ── verdict ──────────────────────────────────────────────────────
  const closedSource =
    input.source === "mercari_sold" || input.source === "yahoo_auction_closed";

  let status: ScoreResult["status"];

  if (
    closedSource &&
    match >= 75 &&
    !hasPenaltyWord &&
    priceOk &&
    input.price > 0
  ) {
    status = "auto_approved";
  } else if (match < 60 || hasPenaltyWord) {
    status = "rejected";
  } else {
    status = "pending";
  }

  return { matchScore: match, trustScore: trust, status };
}
