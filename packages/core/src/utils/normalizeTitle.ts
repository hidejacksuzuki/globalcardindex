/**
 * normalizeTitle / normalizeCardKey
 *
 * Collapses vendor-supplied title variants into canonical forms so the same
 * card from different marketplaces lines up in the DB.
 *
 * Pipeline (applied in order):
 *   1. Full-width ASCII → half-width  （Ａ → A, ０ → 0, … ）
 *   2. Full-width spaces → ASCII space
 *   3. Katakana → hiragana            （ポケモン → ぽけもん）
 *   4. Strip common noise brackets    （【】「」『』〔〕()（）[]【 】）
 *   5. Strip trailing/leading noise   （★☆◆◇■□▲▼●○♠♣♥♦※†‡）
 *   6. Collapse whitespace, trim
 *   7. Lowercase (ASCII only — kanji/kana are case-insensitive already)
 *
 * normalizeCardKey additionally:
 *   - strips ALL remaining punctuation (・、。・ー～〜-_/ etc.)
 *   - collapses spaces again
 *
 * Use normalizeTitle for display / search queries where partial readability
 * is still wanted.  Use normalizeCardKey as a dedup / grouping key.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Full-width ASCII (！～) → half-width (!~) */
function toHalfWidthAscii(s: string): string {
  return s.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/** Full-width space (　 U+3000) → ASCII space */
function toHalfWidthSpace(s: string): string {
  return s.replace(/　/g, " ");
}

/**
 * Katakana → hiragana.
 * Covers the standard block U+30A1–U+30F6 (ァ–ヶ) plus ヴ (U+30F4).
 * Katakana prolonged sound mark ー (U+30FC) → ー kept as-is (already hiragana-compatible).
 */
function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

/** Remove bracket wrappers that often contain condition/grading noise */
const NOISE_BRACKETS_RE =
  /[【】「」『』〔〕｢｣（）\(\)\[\]]/g;

/** Remove leading/trailing decorative symbols used in listing titles */
const DECORATIVE_SYMBOLS_RE =
  /[★☆◆◇■□▲▼●○♠♣♥♦※†‡◎♪【】]/g;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Normalize a card title for display-level matching.
 * Preserves kanji/kana/digits; strips the most common noise.
 */
export function normalizeTitle(input: string): string {
  let s = input;
  s = toHalfWidthAscii(s);
  s = toHalfWidthSpace(s);
  s = katakanaToHiragana(s);
  s = s.replace(NOISE_BRACKETS_RE, " ");
  s = s.replace(DECORATIVE_SYMBOLS_RE, " ");
  s = s.trim().toLowerCase().replace(/\s+/g, " ");
  return s;
}

/**
 * Build a compact dedup/grouping key from a card title.
 * Strips ALL punctuation and spacing so minor formatting differences collapse
 * to the same key.
 *
 * Example:
 *   "リザードン ex (SVP) NM"  →  "りざーどんexsvpnm"
 *   "リザードンEX【SVP】NM"   →  "りざーどんexsvpnm"
 */
export function normalizeCardKey(input: string): string {
  let s = normalizeTitle(input);
  // Strip punctuation: Japanese and ASCII punctuation, hyphens, slashes, dots.
  // NOTE: ー (U+30FC prolonged sound mark) is intentionally kept — it is
  // semantically significant in card names (リザードン ≠ リザドン).
  s = s.replace(/[・、。～〜\-_/\\.,・:;!?'"#@&%^*+=|<>`~]/g, "");
  // Collapse any remaining spaces
  s = s.replace(/\s+/g, "");
  return s;
}

/**
 * Build a canonical card key from individual DB fields.
 * Used to detect near-duplicate card rows.
 *
 * Returns a string in the form:
 *   "{normalizedName}|{normalizedSet}|{normalizedRarity}|{condition}"
 */
export function cardDedupeKey(fields: {
  name:      string;
  setName:   string;
  rarity:    string;
  condition: string;
}): string {
  return [
    normalizeCardKey(fields.name),
    normalizeCardKey(fields.setName),
    normalizeCardKey(fields.rarity),
    fields.condition.trim().toLowerCase(),
  ].join("|");
}
