/**
 * fonts.ts
 * next/og 用フォントローダー。
 * Noto Sans JP を Google Fonts から取得する。
 * フェッチ失敗時は null を返し、呼び元がフォールバックする。
 */

const GOOGLE_FONTS_URL =
  "https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.woff";

// モジュールレベルキャッシュ（同一コンテナ内で再利用）
let cachedFont: ArrayBuffer | null | undefined = undefined;

export async function loadNotoSansJP(): Promise<ArrayBuffer | null> {
  if (cachedFont !== undefined) return cachedFont;

  try {
    const res = await fetch(GOOGLE_FONTS_URL, {
      // Vercel Edge / Node.js どちらでも動作
      cache: "force-cache",
    });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    cachedFont = await res.arrayBuffer();
    return cachedFont;
  } catch (e) {
    console.warn("[og/fonts] Noto Sans JP の読み込みに失敗しました:", e);
    cachedFont = null;
    return null;
  }
}
