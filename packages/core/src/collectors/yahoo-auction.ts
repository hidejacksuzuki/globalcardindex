/**
 * Yahoo Auction URL generator + scoring
 *
 * Roles:
 *   yahoo_auction_active  — active listings (参考値、指数に含めない)
 *   yahoo_auction_closed  — sold results  (落札価格、指数の主力)
 */

const YAHUOKU_SEARCH_BASE = "https://auctions.yahoo.co.jp/search/search";
const YAHUOKU_CLOSED_BASE = "https://auctions.yahoo.co.jp/closedsearch/closedsearch";

// ── URL builders ──────────────────────────────────────────────────────────────

/** 開催中オークション検索 */
export function buildYahooAuctionSearchUrl(keyword: string): string {
  return `${YAHUOKU_SEARCH_BASE}?${new URLSearchParams({ p: keyword }).toString()}`;
}

/** 落札相場（終了済み）検索 — tab_ex=commerce で落札済みを明示 */
export function buildYahooAuctionClosedSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    p: keyword, tab_ex: "commerce", auccat: "0",
    s1: "end", o1: "d", b: "1", n: "50", ei: "utf-8",
  });
  return `${YAHUOKU_SEARCH_BASE}?${params.toString()}`;
}

/** 開催中オークション検索（別名エクスポート） */
export function buildYahooAuctionActiveSearchUrl(keyword: string): string {
  return buildYahooAuctionSearchUrl(keyword);
}

/** カード情報から両方のURLをまとめて生成 */
export function buildYahooAuctionUrls(name: string, rarity: string, setName: string): {
  keyword:   string;
  activeUrl: string;
  closedUrl: string;
} {
  const keyword = `${name} ${rarity} ${setName}`.trim();
  return {
    keyword,
    activeUrl: buildYahooAuctionSearchUrl(keyword),
    closedUrl: buildYahooAuctionClosedSearchUrl(keyword),
  };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const EXCLUDE_WORDS_YA = [
  "オリパ", "引退品", "まとめ", "大量", "セット売り", "福袋",
  "未開封BOX", "海外版", "英語版", "中国語", "韓国語",
  "proxy", "プレイ用", "状態難", "偽物", "レプリカ",
];

const BULK_WORDS_YA   = ["まとめ", "大量", "セット", "福袋"];
const LANGUAGE_YA     = ["海外版", "英語版", "中国語", "韓国語", "英語"];
const CONDITION_BAD   = ["傷あり", "状態難", "ジャンク"];

export type AuctionScoringTarget = {
  name:    string;
  rarity:  string;
  setName: string;
};

export type AuctionScoringResult = {
  matchScore: number;
  trustScore: number;
  reasons:    string[];
};

export function calcAuctionScore(
  title:    string,
  target:   AuctionScoringTarget,
  isClosed: boolean,
  bidCount?: number,
): AuctionScoringResult {
  const t       = title.toLowerCase();
  const reasons: string[] = [];
  let score     = 0;

  // +35: card name match
  if (target.name && t.includes(target.name.toLowerCase())) {
    score += 35; reasons.push("カード名一致 +35");
  }
  // +25: rarity match
  if (target.rarity && t.includes(target.rarity.toLowerCase())) {
    score += 25; reasons.push("レアリティ一致 +25");
  }
  // +20: set code match
  const setCode = target.setName.replace(/\s+/g, "").toLowerCase();
  if (setCode && t.replace(/\s+/g, "").includes(setCode)) {
    score += 20; reasons.push("型番一致 +20");
  }
  // +20: closed (sold) auction
  if (isClosed) {
    score += 20; reasons.push("落札済み +20");
  }
  // +10: has bids
  if (bidCount != null && bidCount > 0) {
    score += 10; reasons.push(`入札数あり(${bidCount}) +10`);
  }
  // +20: grading
  if (/psa|bgs|ars/i.test(title)) {
    score += 20; reasons.push("鑑定品 +20");
  }

  // -50: オリパ
  if (title.includes("オリパ")) { score -= 50; reasons.push("オリパ -50"); }

  // -40: まとめ / 引退
  if (BULK_WORDS_YA.some((w) => title.includes(w))) { score -= 40; reasons.push("まとめ売り -40"); }
  if (title.includes("引退品"))  { score -= 40; reasons.push("引退品 -40"); }

  // -30: 言語違い
  if (LANGUAGE_YA.some((w) => title.includes(w))) { score -= 30; reasons.push("言語違い -30"); }

  // -30: 状態難
  if (CONDITION_BAD.some((w) => title.includes(w))) { score -= 30; reasons.push("状態難 -30"); }

  // -80: 偽物
  if (title.includes("偽物") || title.includes("レプリカ")) { score -= 80; reasons.push("偽物 -80"); }

  const matchScore = Math.max(0, Math.min(100, score));
  const trustScore = Math.max(0, Math.min(100, matchScore + (bidCount ?? 0 > 3 ? 5 : 0)));

  return { matchScore, trustScore, reasons };
}
