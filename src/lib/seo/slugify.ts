/**
 * slugify.ts
 * カード名・セット名 → SEO フレンドリーなスラッグへ変換。
 * 日本語はローマ字変換せず除去し、英数字ハイフンのみで構成。
 */

// 日本語文字を除去し ASCII + ラテン拡張のみ残す
function stripNonAscii(str: string): string {
  return str
    .normalize("NFD")                     // ダイアクリティカルを分解
    .replace(/[̀-ͯ]/g, "")      // 結合文字を除去
    .replace(/[^\x00-\x7F]/g, " ");       // 非ASCII（漢字・カナ等）をスペースへ
}

/**
 * 任意の文字列をスラッグ化する。
 * e.g. "Charizard ex SV4a PSR NM" → "charizard-ex-sv4a-psr-nm"
 * e.g. "リザードンex SV4a PSR NM" → "sv4a-psr-nm"  (日本語部分は消える)
 */
export function slugify(str: string): string {
  return stripNonAscii(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // 英数字以外はハイフンへ
    .replace(/^-+|-+$/g, "")       // 先頭・末尾のハイフンを除去
    .replace(/-{2,}/g, "-");       // 連続ハイフンを単一に
}

/**
 * カード固有のスラッグを生成する。
 * name + setName + rarity + condition の組み合わせで一意性を確保する。
 */
export function cardSlug(
  name: string,
  setName: string,
  rarity: string,
  condition: string,
): string {
  return [name, setName, rarity, condition]
    .map(slugify)
    .filter(Boolean)
    .join("-");
}
