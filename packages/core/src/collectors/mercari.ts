/**
 * Mercari search URL generator
 *
 * Builds jp.mercari.com/search URLs from watchlist card entries.
 * Does NOT perform any HTTP requests — URL generation only.
 *
 * Mercari search query params (as of 2025):
 *   keyword   — search string
 *   price_min — minimum price (JPY)
 *   price_max — maximum price (JPY)
 *   status    — 1=on_sale, 2=sold_out  (default: 1)
 *   sort      — created_time, price, etc.
 *   order     — desc / asc
 *
 * Category IDs for TCG cards (Japan Mercari):
 *   752  — トレーディングカード（ゲーム）
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type WatchlistEntry = {
  game:       string;
  cardName:   string;
  set:        string;
  rarity:     string;
  conditions: string[];   // ["NM", "LP", ...]
  minPrice:   number;
  maxPrice:   number;
  keywords:   string;     // custom keyword override (empty → auto-build)
  active:     boolean;
};

export type MercariSearchLink = {
  game:         string;
  cardName:     string;
  set:          string;
  rarity:       string;
  condition:    string;
  keyword:      string;
  /** おすすめ順 (sort=score) — primary URL */
  url:          string;
  /** 価格安い順 (sort=price&order=asc) */
  lowPriceUrl:  string;
  /** 価格高い順 (sort=price&order=dsc) */
  highPriceUrl: string;
  priceRange:   string;   // human-readable "¥15,000 – ¥45,000"
  minPrice:     number;
  maxPrice:     number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MERCARI_BASE = "https://jp.mercari.com/search";

/** Default exclusion keywords to filter noise listings */
export const DEFAULT_EXCLUDE_KEYWORDS =
  "オリパ 引退品 まとめ 海外 英語 proxy プレイ用 傷あり";

// ── URL builder ───────────────────────────────────────────────────────────────

/**
 * Build a single Mercari search URL.
 *
 * @param sort  "score" (default/relevance) | "price"
 * @param order "asc" | "dsc" — only used when sort="price"
 */
export function buildMercariSearchUrl(opts: {
  keyword:          string;
  minPrice?:        number;
  maxPrice?:        number;
  sort?:            "score" | "price";
  order?:           "asc" | "dsc";
  excludeKeywords?: string;
}): string {
  const params = new URLSearchParams();

  params.set("keyword",         opts.keyword);
  params.set("exclude_keyword", opts.excludeKeywords ?? DEFAULT_EXCLUDE_KEYWORDS);
  params.set("status",          "on_sale");
  params.set("sort",            opts.sort ?? "score");

  if (opts.sort === "price" && opts.order) {
    params.set("order", opts.order);
  }

  if (opts.minPrice != null && opts.minPrice > 0) {
    params.set("price_min", String(opts.minPrice));
  }
  if (opts.maxPrice != null && opts.maxPrice > 0) {
    params.set("price_max", String(opts.maxPrice));
  }

  return `${MERCARI_BASE}?${params.toString()}`;
}

/**
 * Build all 3 search URLs (score / low-price / high-price) for one watchlist entry per condition.
 */
export function buildMercariLinksForEntry(
  entry: WatchlistEntry,
): MercariSearchLink[] {
  if (!entry.active) return [];

  return entry.conditions.map((condition) => {
    const keyword = entry.keywords?.trim()
      ? entry.keywords.trim()
      : `${entry.cardName} ${entry.rarity} ${entry.set}`.trim();

    const base = { keyword, minPrice: entry.minPrice, maxPrice: entry.maxPrice };

    return {
      game:         entry.game,
      cardName:     entry.cardName,
      set:          entry.set,
      rarity:       entry.rarity,
      condition,
      keyword,
      url:          buildMercariSearchUrl({ ...base, sort: "score" }),
      lowPriceUrl:  buildMercariSearchUrl({ ...base, sort: "price", order: "asc" }),
      highPriceUrl: buildMercariSearchUrl({ ...base, sort: "price", order: "dsc" }),
      priceRange:   `¥${entry.minPrice.toLocaleString()} – ¥${entry.maxPrice.toLocaleString()}`,
      minPrice:     entry.minPrice,
      maxPrice:     entry.maxPrice,
    };
  });
}

/**
 * Build all search links for an entire watchlist.
 */
export function buildMercariSearchUrls(
  entries: WatchlistEntry[],
): MercariSearchLink[] {
  return entries.flatMap(buildMercariLinksForEntry);
}

// ── Watchlist CSV parser ──────────────────────────────────────────────────────

/**
 * Parse a raw watchlist CSV string into WatchlistEntry objects.
 * Expected columns (first row = header):
 *   game, cardName, set, rarity, conditions, minPrice, maxPrice, keywords, active
 */
export function parseWatchlistCsv(csv: string): WatchlistEntry[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).flatMap((line) => {
    // Simple CSV split — handles quoted fields with commas for conditions
    const cols = splitCsvLine(line);
    if (cols.length < 8) return [];

    const [game, cardName, set, rarity, condStr, minPriceStr, maxPriceStr, keywords, activeStr] = cols;

    const conditions = condStr.replace(/"/g, "").split(",").map((c) => c.trim()).filter(Boolean);
    const minPrice   = Number(minPriceStr) || 0;
    const maxPrice   = Number(maxPriceStr) || 0;
    const active     = activeStr?.trim().toLowerCase() !== "false";

    if (!cardName?.trim() || !set?.trim()) return [];

    return [{
      game:       game?.trim()     || "unknown",
      cardName:   cardName.trim(),
      set:        set.trim(),
      rarity:     rarity?.trim()   || "",
      conditions,
      minPrice,
      maxPrice,
      keywords:   keywords?.trim() || "",
      active,
    }];
  });
}

/** Minimal CSV line splitter that handles a single level of double-quoted fields */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── source 別 URL ビルダー ────────────────────────────────────────────────────

/** Mercari 売り切れ (sold_out) 検索URL */
export function buildMercariSoldSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    keyword,
    exclude_keyword: DEFAULT_EXCLUDE_KEYWORDS,
    status: "sold_out",
    sort:   "score",
  });
  return `${MERCARI_BASE}?${params.toString()}`;
}

/** Mercari 販売中 (on_sale) 検索URL */
export function buildMercariListingSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    keyword,
    exclude_keyword: DEFAULT_EXCLUDE_KEYWORDS,
    status: "on_sale",
    sort:   "score",
  });
  return `${MERCARI_BASE}?${params.toString()}`;
}

