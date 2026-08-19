/**
 * fonts.ts
 * next/og 用フォントローダー。
 * Noto Sans JP を Google Fonts から取得する。
 * フェッチ失敗時は null を返し、呼び元がフォールバックする。
 *
 * 以前は gstatic のバージョン固定 URL（…/v53/….woff）を直接叩いていたが、
 * バージョン更新で 404 になり OG 画像全体が落ちた（2026-08 に発生）。
 * css2 エンドポイントから現行のフォント URL を解決する方式に変更。
 */

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap";

// モジュールレベルキャッシュ（同一コンテナ内で再利用）
let cachedFont: ArrayBuffer | null | undefined = undefined;

export async function loadNotoSansJP(): Promise<ArrayBuffer | null> {
  if (cachedFont !== undefined) return cachedFont;

  try {
    // UA を付けずに取得すると ttf 形式の URL が返る
    // （satori/ImageResponse は woff2 非対応のため都合が良い）
    const cssRes = await fetch(FONT_CSS_URL, { cache: "force-cache" });
    if (!cssRes.ok) throw new Error(`font css fetch failed: ${cssRes.status}`);
    const css = await cssRes.text();

    const m = css.match(/src:\s*url\((https:[^)]+\.(?:ttf|otf|woff))\)/);
    if (!m) throw new Error("font url not found in css2 response");

    const res = await fetch(m[1], { cache: "force-cache" });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    cachedFont = await res.arrayBuffer();
    return cachedFont;
  } catch (e) {
    console.warn("[og/fonts] Noto Sans JP の読み込みに失敗しました:", e);
    cachedFont = null;
    return null;
  }
}
