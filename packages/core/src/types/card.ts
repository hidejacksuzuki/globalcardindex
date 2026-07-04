export type CardSummary = {
  id: string;
  name: string;
  setName: string;
  rarity: string;
  condition: string;
};

// Week 2: 一覧表示で price 列を出すために最新価格を含む型
export type CardSummaryWithPrice = CardSummary & {
  slug: string | null;
  latestPrice: number | null;
  currency: string | null;
  lastObservedAt: string | null; // ISO8601
};

export type PriceRecord = {
  id: string;
  price: number;
  currency: string;
  sourceType: string;
  sourceName: string;
  observedAt: string; // ISO8601
  trustScore: number;
  notes: string | null;
};

export type CardWithPrices = CardSummary & {
  prices: PriceRecord[];
  totalPriceCount: number;
};

export type CardSortKey = "name" | "latestPrice" | "popular";
export type SortOrder  = "asc" | "desc";

export type ListCardsResult = {
  cards: CardSummaryWithPrice[];   // price 込みに変更
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
