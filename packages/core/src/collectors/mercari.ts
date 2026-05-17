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
  game:       string;
  cardName:   string;
  set:        string;
  rarity:     string;
  condition:  string;
  keyword:    string;
  url:        string;
  priceRange: string;     // human-readable "¥15,000 – ¥45,000"
  minPrice:   number;
  maxPrice:   number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MERCARI_BASE      = "https://jp.mercari.com/search";
const MERCARI_CATEGORY  = "752";    // TCGカード

/** Japanese condition label map for search keywords */
const CONDITION_JP: Record<string, string> = {
  NM:  "美品",
  LP:  "良品",
  MP:  "中程度",
  HP:  "傷あり",
  DMG: "傷・汚れあり",
};

// ── URL builder ───────────────────────────────────────────────────────────────

/**
 * Build a single Mercari search URL for one card + condition combo.
 */
export function buildMercariSearchUrl(opts: {
  keyword:   string;
  condition: string;
  minPrice?: number;
  maxPrice?: number;
  soldOut?:  boolean;   // true → search sold listings (for price research)
}): string {
  const params = new URLSearchParams();

  // Append condition keyword if known
  const condJp = CONDITION_JP[opts.condition.toUpperCase()];
  const keyword = condJp
    ? `${opts.keyword} ${condJp}`
    : opts.keyword;

  params.set("keyword",       keyword);
  params.set("category_id",   MERCARI_CATEGORY);
  params.set("status",        opts.soldOut ? "2" : "1");
  params.set("sort",          "created_time");
  params.set("order",         "desc");

  if (opts.minPrice != null && opts.minPrice > 0) {
    params.set("price_min", String(opts.minPrice));
  }
  if (opts.maxPrice != null && opts.maxPrice > 0) {
    params.set("price_max", String(opts.maxPrice));
  }

  return `${MERCARI_BASE}?${params.toString()}`;
}

/**
 * Build all search links for one watchlist entry (one per condition).
 */
export function buildMercariLinksForEntry(
  entry: WatchlistEntry,
): MercariSearchLink[] {
  if (!entry.active) return [];

  return entry.conditions.map((condition) => {
    // Keyword: use explicit override if set, otherwise auto-build
    const keyword = entry.keywords?.trim()
      ? entry.keywords.trim()
      : `${entry.cardName} ${entry.rarity} ${entry.set}`;

    const url = buildMercariSearchUrl({
      keyword,
      condition,
      minPrice: entry.minPrice,
      maxPrice: entry.maxPrice,
    });

    const priceRange = `¥${entry.minPrice.toLocaleString()} – ¥${entry.maxPrice.toLocaleString()}`;

    return {
      game:       entry.game,
      cardName:   entry.cardName,
      set:        entry.set,
      rarity:     entry.rarity,
      condition,
      keyword,
      url,
      priceRange,
      minPrice:   entry.minPrice,
      maxPrice:   entry.maxPrice,
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
