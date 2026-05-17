export type MarketboardRow = {
  cardId: string;
  name: string;
  setName: string;
  rarity: string;
  condition: string;
  latestPrice: number | null;
  currency: string | null;
  changeRate: number | null; // % vs trailing-window weighted aggregate
  dataPoints: number;
  lastObservedAt: string | null; // ISO8601
  // Week 19: per-card index quality (null when no IndexValue exists)
  indexValue:   number | null;
  indexChange:  number | null;
  sampleCount:  number | null;
  confidence:   string | null; // "HIGH" | "MED" | "LOW" | null
};

export type IndexSnapshot = {
  value: number;
  changeRate: number;
  calculatedAt: string; // ISO8601
};

export const MARKET_SORT_KEYS = ["price", "changeRate", "count"] as const;
export type MarketSortKey = (typeof MARKET_SORT_KEYS)[number];
export type MarketSortOrder = "asc" | "desc";
