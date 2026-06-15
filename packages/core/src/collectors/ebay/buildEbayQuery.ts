/**
 * eBay 検索クエリビルダー
 *
 * CardAlias の情報から最適な検索クエリと除外キーワードを生成する。
 * cardNumber が存在する場合は必ずクエリに含め、誤マッチを最小化する。
 */

export type EbayQueryInput = {
  name:             string;
  setName?:         string | null;
  cardNumber?:      string | null;
  rarity?:          string | null;
  language?:        string | null;   // "Japanese" | "English" | "Korean"
  negativeKeywords?: string | null;  // カンマ区切り
};

export type EbayQueryResult = {
  query:            string;
  negativeKeywords: string[];
};

const DEFAULT_NEGATIVE_KEYWORDS = [
  "PSA", "BGS", "CGC", "graded", "slab",
  "proxy", "custom", "fan made",
  "lot", "bulk",
  "sealed", "booster", "pack", "box", "case",
  "digital", "code",
];

/**
 * 検索クエリを生成する。
 *
 * 優先度:
 *  1. name + cardNumber + setName + language
 *  2. name + cardNumber + language
 *  3. name + setName + language
 */
export function buildEbayQuery(input: EbayQueryInput): EbayQueryResult {
  const parts: string[] = [];

  // カード名は必須
  parts.push(input.name.trim());

  // カード番号（最も識別力が高い）
  if (input.cardNumber?.trim()) {
    parts.push(input.cardNumber.trim());
  }

  // セット名（長すぎる場合は先頭の単語のみ）
  if (input.setName?.trim()) {
    const setToken = input.setName.trim().split(/\s+/)[0];
    if (setToken && setToken.length <= 20) {
      parts.push(setToken);
    }
  }

  // 言語表記（Japanese / English など）
  if (input.language?.trim()) {
    parts.push(input.language.trim());
  }

  const query = parts.join(" ");

  // 除外キーワード
  const negativeKeywords = input.negativeKeywords
    ? input.negativeKeywords.split(",").map((k) => k.trim()).filter(Boolean)
    : [...DEFAULT_NEGATIVE_KEYWORDS];

  return { query, negativeKeywords };
}

/**
 * CardAlias から searchQuery を自動生成して返す。
 * CardAlias.searchQuery が手動入力済みの場合はそれを優先する。
 */
export function resolveSearchQuery(alias: {
  searchQuery?:      string | null;
  name:              string;
  setName?:          string | null;
  cardNumber?:       string | null;
  rarity?:           string | null;
  language?:         string | null;
  negativeKeywords?: string | null;
}): EbayQueryResult {
  if (alias.searchQuery?.trim()) {
    const negativeKeywords = alias.negativeKeywords
      ? alias.negativeKeywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [...DEFAULT_NEGATIVE_KEYWORDS];
    return { query: alias.searchQuery.trim(), negativeKeywords };
  }
  return buildEbayQuery(alias);
}
