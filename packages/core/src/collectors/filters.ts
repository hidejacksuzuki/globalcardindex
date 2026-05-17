/**
 * Collector filter utilities
 *
 * Four-layer filter pipeline for raw Mercari listings:
 *   1. Graded card detection  — PSA / BGS / CGC / 鑑定 etc.
 *   2. Bundle detection       — まとめ / N枚 / デッキ / box
 *   3. Fake / non-commercial  — コピー / サンプル / 非売品
 *   4. Accessory-only         — スリーブのみ / ケースのみ
 *   5. Damage                 — ジャンク / 書き込み / 折れ
 *   6. Price range            — min/max band from watchlist
 *   7. Zero/invalid price     — sanity check
 *
 * Design goals:
 *   – False negatives (letting bad data in) cost more than false positives
 *   – Every rejection has a machine-readable `category` for UI badge coloring
 *   – All filters are pure functions — easy to unit-test via testFilter()
 *   – Shipping annotations (送料込み etc.) are non-rejecting flags on pass
 */

import { normalizeTitle } from "../utils/normalizeTitle";

// ── Rejection categories ──────────────────────────────────────────────────────

/**
 * Machine-readable category for the review UI.
 * Maps to badge colors in /admin/collector/review.
 */
export type FilterCategory =
  | "graded"      // PSA / BGS / 鑑定 — needs separate graded pipeline
  | "bundle"      // まとめ / N枚 / セット — multi-card listings
  | "fake"        // コピー / サンプル / 非売品
  | "accessory"   // スリーブのみ / ケースのみ
  | "damage"      // ジャンク / 書き込み / 折れ
  | "price"       // out of watchlist price band or invalid
  | "ng_word";    // legacy catch-all for custom NG words

// ── Filter result type ────────────────────────────────────────────────────────

export type FilterResult =
  | {
      pass:             true;
      condition:        string | null;
      /** Non-rejecting flags detected in title */
      annotations:      FilterAnnotation[];
    }
  | {
      pass:             false;
      reason:           string;         // human-readable
      category:         FilterCategory;
    };

export type FilterAnnotation =
  | { type: "shipping_included" }   // 送料込み — price reflects shipping
  | { type: "shipping_separate" }   // 送料別 — buyer pays shipping on top
  | { type: "shipping_free" };      // 送料無料

// ── Pattern banks ─────────────────────────────────────────────────────────────

/** Grading service patterns — word boundary sensitive where possible */
const GRADED_PATTERNS: RegExp[] = [
  /\bpsa\s*\d*/i,               // PSA, PSA10, PSA 10
  /\bbgs\s*\d*/i,               // BGS, BGS 9.5
  /\bcgc\s*\d*/i,               // CGC
  /\bsgc\s*\d*/i,               // SGC
  /\bhga\s*\d*/i,               // HGA
  /\bgai\s*\d*/i,               // GAI
  /\bace\s*\d*/i,               // ACE grading (Japan)
  /\bcsg\s*\d*/i,               // CSG
  /鑑定/,                        // 鑑定済み, 鑑定品
  /グレーディング/,
  /グレード済/,
  /スラブ/,                      // slab case
  /ケース入り.*鑑定|鑑定.*ケース入り/,
];

/** Bundle / multi-card listing patterns */
const BUNDLE_PATTERNS: RegExp[] = [
  /まとめ/,                          // まとめ売り, まとめ買い
  /セット売り/,
  /枚セット/,
  /袋|袋売り/,
  /[2-9]\d*\s*枚/,                  // 2枚〜 (single digit quantities)
  /\d{2,}\s*枚/,                    // 10枚以上
  /複数/,
  /デッキ/,                          // deck (60 cards)
  /\bbox\b|\bボックス\b/i,            // box
  /パック\d+|pack.*\d+|\d+.*pack/i,  // N packs
  /全種|全カード/,                    // complete set
  /以上まとめ/,
];

/** Fake / non-commercial / sample patterns */
const FAKE_PATTERNS: RegExp[] = [
  /\bproxy\b/i,
  /コピー(?!ライト)/,              // コピー but not コピーライト
  /偽物/,
  /偽造/,
  /レプリカ/,
  /スーパーコピー/,
  /\bfake\b/i,
  /サンプル(?!カード名)/,          // サンプル — SAMPLE cards
  /\bsample\b/i,
  /非売品/,                        // non-commercial
  /テスト印刷/,
  /test.*print|print.*test/i,
  /custom.*card|card.*custom/i,
];

/** Accessory-only patterns (no card) */
const ACCESSORY_PATTERNS: RegExp[] = [
  /スリーブのみ/,
  /スリーブ付き(?!カード)/,
  /ケースのみ/,
  /ケース付き(?!カード)/,
  /ホルダーのみ/,
  /バインダーのみ/,
  /プレイマットのみ/,
  /ダメカンのみ/,
];

/** Significant damage patterns */
const DAMAGE_PATTERNS: RegExp[] = [
  /ジャンク/,
  /状態悪/,
  /書き込み/,
  /折れ(?!込|線)/,    // 折れ but not 折れ込み
  /欠け/,
  /破損/,
  /汚れひどい/,
  /ぼろぼろ/,
];

/** Shipping annotation patterns (non-rejecting) */
const SHIPPING_PATTERNS: Array<{ pattern: RegExp; type: FilterAnnotation["type"] }> = [
  { pattern: /送料込み|送料込/,  type: "shipping_included" },
  { pattern: /送料別/,          type: "shipping_separate" },
  { pattern: /送料無料/,        type: "shipping_free" },
];

// ── Condition inference ───────────────────────────────────────────────────────

const CONDITION_PATTERNS: Array<{ pattern: RegExp; condition: string }> = [
  { pattern: /美品|nm|near.?mint/i,          condition: "NM" },
  { pattern: /良品|lp|light.?play/i,          condition: "LP" },
  { pattern: /中程度|mp|moderate.?play/i,      condition: "MP" },
  { pattern: /傷あり|ひどい|hp|heavy.?play/i,  condition: "HP" },
  { pattern: /ダメージ|ボロ|dmg|damaged/i,     condition: "DMG" },
];

/**
 * Attempt to infer card condition from a raw title string.
 * Returns null if no condition can be determined.
 */
export function inferConditionFromTitle(rawTitle: string): string | null {
  const lower = rawTitle.toLowerCase();
  for (const { pattern, condition } of CONDITION_PATTERNS) {
    if (pattern.test(lower)) return condition;
  }
  return null;
}

// ── Shipping annotation detection ─────────────────────────────────────────────

function detectAnnotations(title: string): FilterAnnotation[] {
  const annotations: FilterAnnotation[] = [];
  for (const { pattern, type } of SHIPPING_PATTERNS) {
    if (pattern.test(title)) annotations.push({ type });
  }
  return annotations;
}

// ── Filter options ────────────────────────────────────────────────────────────

export type CollectorFilterOptions = {
  minPrice?:   number;
  maxPrice?:   number;
  /** Completely replace the default NG word list */
  ngWords?:    string[];
  /** Appended to (or default) NG words */
  extraNg?:    string[];
  /** Skip specific categories (e.g. skip "damage" to allow HP/DMG cards) */
  skipCategories?: FilterCategory[];
};

// ── Core filter ───────────────────────────────────────────────────────────────

/**
 * Run all filters against a single collected item.
 *
 * Layer order:
 *   graded → bundle → fake → accessory → damage → ng_word → price → valid
 *
 * @returns FilterResult with `pass: false` + `category` for rejections,
 *          or `pass: true` + `condition` + `annotations` on acceptance.
 */
export function filterCollectorItem(
  rawTitle: string,
  price:    number,
  opts:     CollectorFilterOptions = {},
): FilterResult {
  const skip = new Set(opts.skipCategories ?? []);

  // ── 1. Graded card ───────────────────────────────────────────────────────
  if (!skip.has("graded")) {
    for (const re of GRADED_PATTERNS) {
      if (re.test(rawTitle)) {
        return {
          pass:     false,
          reason:   `graded: matched "${re.source}"`,
          category: "graded",
        };
      }
    }
  }

  // ── 2. Bundle / multi-card ───────────────────────────────────────────────
  if (!skip.has("bundle")) {
    for (const re of BUNDLE_PATTERNS) {
      if (re.test(rawTitle)) {
        return {
          pass:     false,
          reason:   `bundle: matched "${re.source}"`,
          category: "bundle",
        };
      }
    }
  }

  // ── 3. Fake / non-commercial ─────────────────────────────────────────────
  if (!skip.has("fake")) {
    for (const re of FAKE_PATTERNS) {
      if (re.test(rawTitle)) {
        return {
          pass:     false,
          reason:   `fake: matched "${re.source}"`,
          category: "fake",
        };
      }
    }
  }

  // ── 4. Accessory only ────────────────────────────────────────────────────
  if (!skip.has("accessory")) {
    for (const re of ACCESSORY_PATTERNS) {
      if (re.test(rawTitle)) {
        return {
          pass:     false,
          reason:   `accessory: matched "${re.source}"`,
          category: "accessory",
        };
      }
    }
  }

  // ── 5. Significant damage ────────────────────────────────────────────────
  if (!skip.has("damage")) {
    for (const re of DAMAGE_PATTERNS) {
      if (re.test(rawTitle)) {
        return {
          pass:     false,
          reason:   `damage: matched "${re.source}"`,
          category: "damage",
        };
      }
    }
  }

  // ── 6. Custom NG words ───────────────────────────────────────────────────
  if (!skip.has("ng_word")) {
    const customNg = [...(opts.ngWords ?? []), ...(opts.extraNg ?? [])];
    const normalized = normalizeTitle(rawTitle);
    for (const word of customNg) {
      const normalizedWord = normalizeTitle(word);
      if (normalizedWord && normalized.includes(normalizedWord)) {
        return {
          pass:     false,
          reason:   `ng_word: "${word}"`,
          category: "ng_word",
        };
      }
    }
  }

  // ── 7. Price range ───────────────────────────────────────────────────────
  if (opts.minPrice != null && price < opts.minPrice) {
    return {
      pass:     false,
      reason:   `price_too_low: ¥${price.toLocaleString()} < min ¥${opts.minPrice.toLocaleString()}`,
      category: "price",
    };
  }
  if (opts.maxPrice != null && price > opts.maxPrice) {
    return {
      pass:     false,
      reason:   `price_too_high: ¥${price.toLocaleString()} > max ¥${opts.maxPrice.toLocaleString()}`,
      category: "price",
    };
  }

  // ── 8. Zero / invalid price ──────────────────────────────────────────────
  if (!Number.isFinite(price) || price <= 0) {
    return {
      pass:     false,
      reason:   `invalid_price: ${price}`,
      category: "price",
    };
  }

  // ── Pass ──────────────────────────────────────────────────────────────────
  return {
    pass:        true,
    condition:   inferConditionFromTitle(rawTitle),
    annotations: detectAnnotations(rawTitle),
  };
}

/**
 * Batch filter.
 * Returns items annotated with their filter result.
 */
export function filterCollectorItems<T extends { rawTitle: string; rawPrice: number }>(
  items: T[],
  opts:  CollectorFilterOptions = {},
): Array<T & { filterResult: FilterResult }> {
  return items.map((item) => ({
    ...item,
    filterResult: filterCollectorItem(item.rawTitle, item.rawPrice, opts),
  }));
}

// ── Test helper ───────────────────────────────────────────────────────────────

export type TestFilterResult = {
  title:    string;
  price:    number;
  pass:     boolean;
  category: FilterCategory | null;
  reason:   string | null;
  condition: string | null;
  annotations: FilterAnnotation[];
};

/**
 * Human-friendly batch tester.
 * Useful for verifying filter coverage in the Node REPL or scripts:
 *
 *   import { testFilter } from "@gci/core";
 *   testFilter([
 *     ["PSA 10 リザードンex", 50000],
 *     ["リザードンex SAR 美品", 18000],
 *   ]).forEach(r => console.log(r));
 */
export function testFilter(
  cases: Array<[title: string, price: number]>,
  opts?: CollectorFilterOptions,
): TestFilterResult[] {
  return cases.map(([title, price]) => {
    const result = filterCollectorItem(title, price, opts);
    return {
      title,
      price,
      pass:        result.pass,
      category:    result.pass ? null : result.category,
      reason:      result.pass ? null : result.reason,
      condition:   result.pass ? result.condition : null,
      annotations: result.pass ? result.annotations : [],
    };
  });
}

// ── Legacy NG word list ───────────────────────────────────────────────────────

/**
 * Kept for backward compatibility with code that passes `opts.ngWords`.
 * The built-in filter layers above supersede this list.
 * @deprecated Use filterCollectorItem() directly — pattern banks cover all cases.
 */
export const DEFAULT_NG_WORDS: string[] = [
  "proxy", "コピー", "偽物", "レプリカ", "スーパーコピー",
  "スリーブのみ", "ケースのみ",
  "まとめ", "セット売り", "複数枚",
  "ジャンク", "状態悪", "書き込み", "折れ", "欠け",
];

// ── Median deviation ──────────────────────────────────────────────────────────

export type MedianDeviation = {
  median:      number | null;
  ratio:       number | null;
  warning:     "low" | "high" | null;
  sampleCount: number;
};

/**
 * Compute how far a candidate price deviates from the median of existing prices.
 *
 * Thresholds:
 *   ratio < LOW_THRESHOLD  → warning "low"   (suspiciously cheap)
 *   ratio > HIGH_THRESHOLD → warning "high"  (suspiciously expensive)
 */
export function computeMedianDeviation(
  candidatePrice:  number,
  existingPrices:  number[],
  opts: {
    lowThreshold?:  number;   // default 0.30
    highThreshold?: number;   // default 3.00
    minSamples?:    number;   // default 3
  } = {},
): MedianDeviation {
  const LOW  = opts.lowThreshold  ?? 0.30;
  const HIGH = opts.highThreshold ?? 3.00;
  const MIN  = opts.minSamples    ?? 3;

  const prices = existingPrices.filter((p) => Number.isFinite(p) && p > 0);

  if (prices.length < MIN) {
    return { median: null, ratio: null, warning: null, sampleCount: prices.length };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

  const ratio   = candidatePrice / median;
  const warning: "low" | "high" | null =
    ratio < LOW  ? "low"  :
    ratio > HIGH ? "high" :
    null;

  return { median, ratio, warning, sampleCount: prices.length };
}
