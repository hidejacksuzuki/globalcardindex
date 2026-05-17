// ----------------------------------------------------------------
// Source Normalizer
//
// 各マーケットプレイスの生値を GCI 標準値に正規化する。
// DB には両方保存（listingType = 正規化後 / rawListingType = 生値）。
// ----------------------------------------------------------------

// 正規化マッピング（大文字小文字・空白を無視して比較）
const LISTING_TYPE_MAP: Record<string, string> = {
  // fixed
  "buy it now":     "fixed",
  "buynow":         "fixed",
  "fixed price":    "fixed",
  "fixed":          "fixed",
  "即決":            "fixed",
  "即決価格":         "fixed",
  "定価":            "fixed",

  // offer
  "best offer":     "offer",
  "make offer":     "offer",
  "offer":          "offer",
  "値下げ交渉":       "offer",
  "値引き":          "offer",

  // auction
  "auction":        "auction",
  "bid":            "auction",
  "オークション":     "auction",
};

export type NormalizedListingType = "fixed" | "auction" | "offer" | "unknown";

export function normalizeListingType(raw: string | null | undefined): NormalizedListingType {
  if (!raw) return "unknown";
  const key = raw.trim().toLowerCase();
  return (LISTING_TYPE_MAP[key] as NormalizedListingType) ?? "unknown";
}

// ----------------------------------------------------------------
// Seller score 正規化
// 各プラットフォームの評価形式 → 0.0 – 1.0 に変換
// ----------------------------------------------------------------
export type SellerScoreInput =
  | { platform: "mercari";    score: number; total: number }   // 良い評価 / 合計
  | { platform: "ebay";       score: number }                  // フィードバック % (0–100)
  | { platform: "tcgplayer";  score: number }                  // 0–5 の星評価
  | { platform: "amazon";     score: number }                  // 0–5 の星評価
  | { platform: "raw";        score: number };                 // すでに 0.0–1.0

export function normalizeSellerScore(input: SellerScoreInput): number {
  const { platform } = input;

  switch (platform) {
    case "mercari": {
      const { score, total } = input;
      if (total === 0) return 0.5;
      return Math.min(1.0, Math.max(0.0, score / total));
    }
    case "ebay":
      return Math.min(1.0, Math.max(0.0, input.score / 100));

    case "tcgplayer":
    case "amazon":
      return Math.min(1.0, Math.max(0.0, input.score / 5));

    case "raw":
      return Math.min(1.0, Math.max(0.0, input.score));
  }
}
