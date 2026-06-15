/**
 * eBay 出品タイトルと CardAlias の一致度スコア計算
 *
 * 0〜100 点でスコア化し、管理画面での承認判断に使用する。
 *
 * 判定目安:
 *   80+ : 自動承認候補
 *   60-79: 要確認
 *   59以下: 自動reject候補（初期段階では全件 pending）
 */

export type MatchScoreInput = {
  title:              string;
  name:               string;
  setName?:           string | null;
  cardNumber?:        string | null;
  rarity?:            string | null;
  language?:          string | null;   // "Japanese" | "English" etc.
  negativeKeywords?:  string | null;   // カンマ区切り
  sellerFeedbackScore?: number | null;
  hasSoldAt?:         boolean;         // soldAt が存在するか
};

export type MatchScoreResult = {
  score:    number;
  reasons:  string[];
};

const GRADED_TERMS   = ["psa", "bgs", "cgc", "graded", "slab"];
const LOT_TERMS      = ["lot", "bulk"];
const SEALED_TERMS   = ["sealed", "booster", "pack", "box", "case"];
const PROXY_TERMS    = ["proxy", "custom", "fan made", "fanmade"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function titleContains(title: string, term: string): boolean {
  return title.includes(term.toLowerCase());
}

export function calculateEbayMatchScore(input: MatchScoreInput): MatchScoreResult {
  const t       = normalize(input.title);
  const reasons: string[] = [];
  let score     = 0;

  // ── 加点 ────────────────────────────────────────────────

  // カード名一致 +30
  if (titleContains(t, input.name)) {
    score += 30;
    reasons.push(`+30 カード名一致: "${input.name}"`);
  }

  // カード番号一致 +30
  if (input.cardNumber?.trim() && titleContains(t, input.cardNumber.trim())) {
    score += 30;
    reasons.push(`+30 カード番号一致: "${input.cardNumber}"`);
  }

  // セット名一致 +20
  if (input.setName?.trim()) {
    const setToken = input.setName.trim().split(/\s+/)[0].toLowerCase();
    if (setToken && titleContains(t, setToken)) {
      score += 20;
      reasons.push(`+20 セット名一致: "${setToken}"`);
    }
  }

  // 言語一致 +15
  if (input.language?.trim() && titleContains(t, input.language.trim())) {
    score += 15;
    reasons.push(`+15 言語一致: "${input.language}"`);
  }

  // レアリティ一致 +10
  if (input.rarity?.trim() && titleContains(t, input.rarity.trim())) {
    score += 10;
    reasons.push(`+10 レアリティ一致: "${input.rarity}"`);
  }

  // soldAt あり +10
  if (input.hasSoldAt) {
    score += 10;
    reasons.push("+10 soldAt あり（実売確認）");
  }

  // 出品者評価が高い +5 (1000以上)
  if (input.sellerFeedbackScore != null && input.sellerFeedbackScore >= 1000) {
    score += 5;
    reasons.push(`+5 出品者評価高 (${input.sellerFeedbackScore})`);
  }

  // ── 減点 ────────────────────────────────────────────────

  // 除外キーワード -40
  if (input.negativeKeywords) {
    for (const kw of input.negativeKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)) {
      if (titleContains(t, kw)) {
        score -= 40;
        reasons.push(`-40 除外KW: "${kw}"`);
        break;
      }
    }
  }

  // PSA/BGS/CGC/graded -50 (negKWと別に明示的に検知)
  for (const term of GRADED_TERMS) {
    if (titleContains(t, term)) {
      score -= 50;
      reasons.push(`-50 グレード品: "${term}"`);
      break;
    }
  }

  // lot/bulk -40
  for (const term of LOT_TERMS) {
    if (titleContains(t, term)) {
      score -= 40;
      reasons.push(`-40 LOT/BULK: "${term}"`);
      break;
    }
  }

  // sealed/pack/box -50
  for (const term of SEALED_TERMS) {
    if (titleContains(t, term)) {
      score -= 50;
      reasons.push(`-50 封入品: "${term}"`);
      break;
    }
  }

  // proxy/custom -50
  for (const term of PROXY_TERMS) {
    if (titleContains(t, term)) {
      score -= 50;
      reasons.push(`-50 プロキシ/カスタム: "${term}"`);
      break;
    }
  }

  // カード番号が指定されているのに不一致 -50
  if (input.cardNumber?.trim() && !titleContains(t, input.cardNumber.trim())) {
    score -= 50;
    reasons.push(`-50 カード番号不一致: "${input.cardNumber}"`);
  }

  // 言語が指定されているのに不一致 -30
  if (input.language?.trim() && !titleContains(t, input.language.trim())) {
    // 言語が分からない場合は減点しない（検知できないだけ）
    // titleに他言語が含まれている場合のみ減点
    const otherLangs = ["english", "japanese", "korean", "chinese"].filter(
      (l) => l !== input.language!.toLowerCase()
    );
    if (otherLangs.some((l) => titleContains(t, l))) {
      score -= 30;
      reasons.push(`-30 言語不一致（他言語を検出）`);
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return { score: finalScore, reasons };
}

/** matchScore から承認判断のラベルを返す */
export function matchScoreLabel(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}
