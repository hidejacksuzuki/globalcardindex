/**
 * eBay 検索プロバイダー抽象レイヤー
 *
 * 将来的に eBay 公式 API / スクレイピング等に差し替え可能な interface を定義する。
 * 現在は Mock 実装を提供する。
 *
 * 実装切り替え方法:
 *   createEbayProvider("mock")  → MockEbayProvider
 *   createEbayProvider("api")   → EbayApiProvider (将来実装)
 */

export type EbayRawListing = {
  title:               string;
  price:               number;
  currency:            string;
  shippingPrice?:      number;
  totalPrice:          number;
  soldAt?:             string;   // ISO 8601
  listingUrl?:         string;
  imageUrl?:           string;
  sellerName?:         string;
  sellerFeedbackScore?: number;
  listingType:         "sold" | "active";
  conditionText?:      string;
  rawJson?:            Record<string, unknown>;
};

export type EbaySearchOptions = {
  query:            string;
  negativeKeywords?: string[];
  listingType?:     "sold" | "active";
  market?:          "US" | "GLOBAL";
  limit?:           number;
};

export type EbaySearchResult = {
  listings:  EbayRawListing[];
  totalFound: number;
  provider:  string;
};

export interface EbaySearchProvider {
  searchSoldListings(options: EbaySearchOptions): Promise<EbaySearchResult>;
}

// ── Mock 実装 ─────────────────────────────────────────────────────────────────

class MockEbayProvider implements EbaySearchProvider {
  async searchSoldListings(options: EbaySearchOptions): Promise<EbaySearchResult> {
    const limit = options.limit ?? 10;
    const query = options.query;

    // モックデータ生成：実際のAPI接続前の開発・テスト用
    const mockListings: EbayRawListing[] = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      title:               `[MOCK] ${query} - Sample Listing ${i + 1}`,
      price:               1000 + i * 500,
      currency:            "USD",
      shippingPrice:       15,
      totalPrice:          1015 + i * 500,
      soldAt:              new Date(Date.now() - i * 86400000).toISOString(),
      listingUrl:          `https://www.ebay.com/itm/mock-${i + 1}`,
      imageUrl:            undefined,
      sellerName:          `mock_seller_${i + 1}`,
      sellerFeedbackScore: 500 + i * 100,
      listingType:         "sold" as const,
      conditionText:       "Very Good",
      rawJson:             { mock: true, index: i, query },
    }));

    return {
      listings:   mockListings,
      totalFound: mockListings.length,
      provider:   "mock",
    };
  }
}

// ── ファクトリー ──────────────────────────────────────────────────────────────

export type EbayProviderType = "mock" | "api";

export function createEbayProvider(type: EbayProviderType = "mock"): EbaySearchProvider {
  switch (type) {
    case "mock":
      return new MockEbayProvider();
    case "api":
      // TODO: eBay Finding API / Browse API 実装時にここに追加
      throw new Error("eBay API provider is not yet implemented. Use EBAY_PROVIDER=mock.");
    default:
      return new MockEbayProvider();
  }
}

/** 環境変数 EBAY_PROVIDER から provider を作成する */
export function createEbayProviderFromEnv(): EbaySearchProvider {
  const type = (process.env.EBAY_PROVIDER ?? "mock") as EbayProviderType;
  return createEbayProvider(type);
}

// ── 為替換算 ─────────────────────────────────────────────────────────────────

const FIXED_RATES: Record<string, number> = {
  USD: 155,   // 1 USD = 155 JPY (固定レート、将来 ExchangeRate テーブルで管理)
  GBP: 195,
  EUR: 165,
  AUD: 100,
  CAD: 115,
};

export function convertToJpy(amount: number, currency: string): number | null {
  const rate = FIXED_RATES[currency.toUpperCase()];
  if (!rate) return null;
  return Math.round(amount * rate);
}

export function convertToUsd(amount: number, currency: string): number | null {
  if (currency.toUpperCase() === "USD") return amount;
  const rate = FIXED_RATES[currency.toUpperCase()];
  if (!rate) return null;
  return Math.round((amount / rate) * 100) / 100;
}
