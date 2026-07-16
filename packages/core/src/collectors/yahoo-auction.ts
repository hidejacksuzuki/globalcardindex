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

/** 落札相場（終了済み）検索 — closedsearch エンドポイント + auctype=2 */
export function buildYahooAuctionClosedSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    p: keyword, auctype: "2", b: "1", n: "50", ei: "utf-8",
  });
  return `${YAHUOKU_CLOSED_BASE}?${params.toString()}`;
}

/** 開催中オークション検索（別名エクスポート） */
export function buildYahooAuctionActiveSearchUrl(keyword: string): string {
  return buildYahooAuctionSearchUrl(keyword);
}

/** カード情報から両方のURLをまとめて生成 */
export function buildYahooAuctionUrls(name: string, rarity: string, setName: string, condition?: string): {
  keyword:   string;
  activeUrl: string;
  closedUrl: string;
} {
  // PSA/BGS 等のグレーディング条件はキーワードに含める
  const condTag = condition && /^(PSA|BGS|ARS)\d/i.test(condition) ? ` ${condition}` : "";
  const keyword = `${name} ${rarity} ${setName}${condTag}`.trim();
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

/**
 * カード名がタイトルに確認できない場合の matchScore 上限。
 *
 * calcAuctionScore は「落札済み(+20) / 入札あり(+10)」という、どの落札にも
 * 付く加点を持つため、rarity(25)+set(20)+closed(20)+bids(10)=75 が
 * カード名ゼロ点で成立し、承認閾値(75)を素通りしてしまう
 * （同一セット・同一レアの別カードが誤承認される問題。2026-07 調査）。
 *
 * そこで「カード名がタイトルに無いものは自動承認させない」ゲートとして、
 * 名前未確認の場合は matchScore をこの値に頭打ちする。
 * 60 は autoVerdict() で "review"（要人手確認）となり、
 * 承認閾値 75 の3経路（updatePrices / import / auto-approve cron）を通さない。
 */
const NAME_REQUIRED_CAP = 60;

/**
 * 名前照合用の正規化: lowercase + 記号・空白を全除去（英数字と文字のみ残す）。
 * トークン抽出側と同じ正規化をハイスタック（タイトル）にも適用することで、
 * "シロナ&カトレア" ↔ "シロナ＆カトレア"、"閃刀姫－ロゼ" ↔ "閃刀姫-ロゼ" などの
 * 記号差を吸収する（トークンだけ記号除去し title は残す非対称を解消）。
 */
function normalizeForName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * カード名の「識別トークン」。レアリティ/型番/接尾辞など、どのカードにも付き得る
 * 汎用語を落として、キャラクター名など識別に効く語だけを残す。
 * 例: "切手BOX ピカチュウ" → ["切手box","ピカチュウ"] / "Mewtwo ex" → ["mewtwo"]
 */
const GENERIC_NAME_TOKENS = new Set([
  "ex", "gx", "v", "vmax", "vstar", "sar", "sr", "hr", "ar", "ur", "rr", "rrr",
  "psa", "bgs", "ars", "cgc", "sa", "ssr", "csr", "psr", "s", "a",
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s　・:：/／\-–—()（）\[\]【】]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 2 && !GENERIC_NAME_TOKENS.has(t));
}

/**
 * カード名がタイトルに存在するか。
 * 連続部分一致ではなく「識別トークンが全てタイトルに含まれるか」で判定するため、
 * 多語名（"切手BOX ピカチュウ" ↔ "…ピカチュウ…切手BOX…"）や区切り差
 * （"ニコ・ロビン" ↔ "ニコ ロビン"）でも正しく一致する。
 * 識別トークンが1つも無い名前（汎用語のみ）は照合不能として false（安全側）。
 */
export function nameMatchesTitle(title: string, name: string): boolean {
  const toks = nameTokens(name);
  if (toks.length === 0) return false;
  const t = normalizeForName(title);
  return toks.every((tok) => t.includes(tok));
}

export type AuctionScoringTarget = {
  name:       string;
  rarity:     string;
  setName:    string;
  condition?: string;
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

  // +35: card name match（識別トークンが全てタイトルに含まれるかで照合）
  const nameHit = !!target.name && nameMatchesTitle(title, target.name);
  if (nameHit) {
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
  // グレーディング条件チェック
  const cardIsGraded   = /^(PSA|BGS|ARS)\d/i.test(target.condition ?? "");
  const titleHasGrading = /psa|bgs|ars/i.test(title);

  if (cardIsGraded && titleHasGrading) {
    score += 20; reasons.push("鑑定品一致 +20");
    // 同グレード（例: PSA10 ↔ "PSA10"）ならさらに加点
    const grade = (target.condition ?? "").toLowerCase().replace(/\s/g, "");
    if (t.replace(/\s/g, "").includes(grade)) {
      score += 10; reasons.push(`グレード一致(${target.condition}) +10`);
    }
  } else if (cardIsGraded && !titleHasGrading) {
    score -= 30; reasons.push("グレーディングカードなのに非鑑定品 -30");
  } else if (!cardIsGraded && titleHasGrading) {
    score -= 30; reasons.push("NM/rawカードに鑑定タグ混入 -30");
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

  let matchScore = Math.max(0, Math.min(100, score));

  // ── カード名必須ゲート ──────────────────────────────────────────────
  // カード名がタイトルに確認できない場合は自動承認させない（誤マッチ防止）。
  // grading 等の加点で 75 を超えていても、名前未確認なら要人手確認へ落とす。
  if (!nameHit && matchScore > NAME_REQUIRED_CAP) {
    matchScore = NAME_REQUIRED_CAP;
    reasons.push(`カード名未確認により ${NAME_REQUIRED_CAP} に頭打ち`);
  }

  // 入札が多い(>3)ものは信頼性を +5（優先順位バグ修正: 以前は bidCount を素通し加算していた）
  const trustBonus = (bidCount ?? 0) > 3 ? 5 : 0;
  const trustScore = Math.max(0, Math.min(100, matchScore + trustBonus));

  return { matchScore, trustScore, reasons };
}
