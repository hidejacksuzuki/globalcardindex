// ----------------------------------------------------------------
// Trust Score v2
//
// スコア = clamp(
//   sourceBaseScore
//   × sourceTrustWeight    // Source.trustWeight（0.0 – 2.0）
//   × sellerMultiplier     // sellerScore が高いほど +補正
//   × listingMultiplier    // fixed > offer > auction > unknown
// , 0, 100)
//
// 各係数は独立していて、後から調整しやすい設計。
// ----------------------------------------------------------------

export const MIN_TRUST     = 0;
export const MAX_TRUST     = 100;
export const DEFAULT_TRUST = 50;

// listingType ごとの信頼補正係数
const LISTING_MULTIPLIERS: Record<string, number> = {
  fixed:   1.0,   // 定価・即決 → 最も信頼できる
  offer:   0.9,   // 値交渉あり → やや割引
  auction: 0.75,  // オークション → 入札価格は変動する
  unknown: 0.85,  // 不明
};

export function clampTrustScore(score: number): number {
  if (Number.isNaN(score)) return DEFAULT_TRUST;
  return Math.max(MIN_TRUST, Math.min(MAX_TRUST, Math.round(score)));
}

// ----------------------------------------------------------------
// computeTrustScore
// ----------------------------------------------------------------
export type TrustScoreInput = {
  /** Source.defaultTrustScore（0 – 100） */
  sourceDefaultScore: number;
  /** Source.trustWeight（0.0 – 2.0、デフォルト 1.0） */
  sourceTrustWeight:  number;
  /** Price.sellerScore（0.0 – 1.0、なければ null） */
  sellerScore:        number | null;
  /** Price.listingType（正規化済み） */
  listingType:        string | null;
  /**
   * Week 18 additions (all optional — backward compatible):
   */
  /** Price.availability — "sold" listings are more reliable than "in_stock" */
  availability?:      string | null;
  /** Whether the listing has a URL (raw source URL). Presence adds confidence. */
  hasUrl?:            boolean;
};

// Week 18 bonus constants — kept small to avoid overwhelming v2 factors
const SOLD_BONUS    = 10;  // sold listing → confirmed transaction price
const URL_BONUS     =  5;  // URL present → verifiable source

export function computeTrustScore(input: TrustScoreInput): number {
  const {
    sourceDefaultScore,
    sourceTrustWeight,
    sellerScore,
    listingType,
    availability = null,
    hasUrl       = false,
  } = input;

  const base         = clamp(sourceDefaultScore, MIN_TRUST, MAX_TRUST);
  const weightedBase = base * clamp(sourceTrustWeight, 0, 2.0);
  const sellerBonus  = sellerScore !== null ? (sellerScore - 0.5) * 30 : 0;
  const soldBonus    = availability === "sold" ? SOLD_BONUS : 0;
  const urlBonus     = hasUrl ? URL_BONUS : 0;
  const listingMult  =
    LISTING_MULTIPLIERS[listingType ?? "unknown"] ??
    LISTING_MULTIPLIERS["unknown"];

  return clampTrustScore((weightedBase + sellerBonus + soldBonus + urlBonus) * listingMult);
}

// ----------------------------------------------------------------
// computeTrustBreakdown
// スコアの各成分を返す（デバッグ・チューニング用）
// ----------------------------------------------------------------
export type TrustBreakdown = {
  sourceBase:        number;   // Source.defaultTrustScore (0-100)
  weightedBase:      number;   // sourceBase × trustWeight
  weightDelta:       number;   // weightedBase - sourceBase (正=増幅, 負=減衰)
  sellerBonus:       number;   // (sellerScore - 0.5) × 30  (null → 0)
  soldBonus:         number;   // +10 if availability === "sold"
  urlBonus:          number;   // +5 if hasUrl
  listingMultiplier: number;   // LISTING_MULTIPLIERS 値 (0.75-1.0)
  listingLabel:      string;   // "fixed" | "offer" | "auction" | "unknown"
  preClamp:          number;   // (weightedBase + bonuses) × listingMult
  final:             number;   // clamp 後の最終スコア
};

export function computeTrustBreakdown(input: TrustScoreInput): TrustBreakdown {
  const {
    sourceDefaultScore,
    sourceTrustWeight,
    sellerScore,
    listingType,
    availability = null,
    hasUrl       = false,
  } = input;

  const sourceBase        = clamp(sourceDefaultScore, MIN_TRUST, MAX_TRUST);
  const weightedBase      = sourceBase * clamp(sourceTrustWeight, 0, 2.0);
  const weightDelta       = weightedBase - sourceBase;
  const sellerBonus       = sellerScore !== null ? (sellerScore - 0.5) * 30 : 0;
  const soldBonus         = availability === "sold" ? 10 : 0;
  const urlBonus          = hasUrl ? 5 : 0;
  const listingLabel      = listingType && listingType in LISTING_MULTIPLIERS
    ? listingType
    : "unknown";
  const listingMultiplier = LISTING_MULTIPLIERS[listingLabel]!;
  const preClamp          = (weightedBase + sellerBonus + soldBonus + urlBonus) * listingMultiplier;
  const final             = clampTrustScore(preClamp);

  return {
    sourceBase,
    weightedBase,
    weightDelta,
    sellerBonus,
    soldBonus,
    urlBonus,
    listingMultiplier,
    listingLabel,
    preClamp,
    final,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
