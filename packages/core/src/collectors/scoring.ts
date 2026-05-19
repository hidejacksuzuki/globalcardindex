/**
 * Listing scoring — matchScore and trustScore calculation
 *
 * matchScore: how well a listing title matches a target card (0–100)
 * trustScore: how reliable/clean the listing is (0–100)
 */

// ── Noise / signal word lists ─────────────────────────────────────────────────

const EXCLUDE_WORDS = [
  "オリパ", "引退品", "まとめ", "大量", "セット売り", "福袋",
  "未開封BOX", "海外版", "英語版", "中国語", "韓国語",
  "proxy", "プレイ用", "傷あり", "ジャンク", "レプリカ",
  "高確率", "確定",
];

const BULK_WORDS = ["まとめ", "大量", "セット", "福袋"];

const LANGUAGE_WORDS = ["海外版", "英語版", "中国語", "韓国語", "英語"];

const QUALITY_WORDS = ["SAR", "SR", "HR", "PSA10", "美品", "ワンオーナー", "鑑定品", "BGS", "ARS"];

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScoringTarget = {
  name:    string;
  rarity:  string;
  setName: string;
};

export type ScoringResult = {
  matchScore: number;
  trustScore: number;
  reasons:    string[];
};

// ── matchScore ────────────────────────────────────────────────────────────────

export function calcMatchScore(
  title: string,
  target: ScoringTarget,
  price?: number,
  priceMin?: number,
  priceMax?: number,
): ScoringResult {
  const t       = title.toLowerCase();
  const reasons: string[] = [];
  let score     = 0;

  // +40: card name match
  if (target.name && t.includes(target.name.toLowerCase())) {
    score += 40;
    reasons.push(`カード名一致 +40`);
  }

  // +25: rarity match
  if (target.rarity && t.includes(target.rarity.toLowerCase())) {
    score += 25;
    reasons.push(`レアリティ一致 +25`);
  }

  // +20: set/version match
  const setCode = target.setName.replace(/\s+/g, "").toLowerCase();
  if (setCode && t.replace(/\s+/g, "").includes(setCode)) {
    score += 20;
    reasons.push(`型番一致 +20`);
  }

  // +20: grading mention (PSA/BGS/ARS)
  if (/psa|bgs|ars/i.test(title)) {
    score += 20;
    reasons.push(`鑑定品 +20`);
  }

  // -50: any exclude word
  const foundExclude = EXCLUDE_WORDS.filter((w) =>
    title.includes(w) || t.includes(w.toLowerCase())
  );
  if (foundExclude.length > 0) {
    score -= 50;
    reasons.push(`除外ワード(${foundExclude[0]}) -50`);
  }

  // -40: bulk sale
  const foundBulk = BULK_WORDS.filter((w) => title.includes(w));
  if (foundBulk.length > 0) {
    score -= 40;
    reasons.push(`まとめ売り -40`);
  }

  // -30: wrong language
  const foundLang = LANGUAGE_WORDS.filter((w) => title.includes(w));
  if (foundLang.length > 0) {
    score -= 30;
    reasons.push(`言語違い -30`);
  }

  // -30: price out of range
  if (price != null && priceMin != null && priceMax != null) {
    if (price < priceMin * 0.3 || price > priceMax * 3) {
      score -= 30;
      reasons.push(`価格異常 -30`);
    }
  }

  return {
    matchScore: Math.max(0, Math.min(100, score)),
    trustScore: calcTrustScore(title, score),
    reasons,
  };
}

// ── trustScore ────────────────────────────────────────────────────────────────

function calcTrustScore(title: string, matchScore: number): number {
  let trust = matchScore;

  // bonus for quality signals
  const qualityCount = QUALITY_WORDS.filter((w) =>
    title.toUpperCase().includes(w.toUpperCase())
  ).length;
  trust += qualityCount * 5;

  // penalty for exclude words already counted in matchScore
  // (no double-penalty — trust is derived from match)

  return Math.max(0, Math.min(100, trust));
}

// ── Auto-verdict ──────────────────────────────────────────────────────────────

export type Verdict = "approved" | "review" | "rejected";

export function autoVerdict(matchScore: number): Verdict {
  if (matchScore >= 80) return "approved";
  if (matchScore >= 60) return "review";
  return "rejected";
}
