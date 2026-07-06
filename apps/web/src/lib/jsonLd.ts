/**
 * JSON-LD を <script dangerouslySetInnerHTML> に安全に埋め込むためのヘルパー。
 *
 * セキュリティ監査 (2026-07-06): JSON.stringify は "<" や "/" をエスケープしない。
 * カード名等のユーザー影響下データに "</script><script>...</script>" が含まれると
 * script タグが途中で閉じられ、後続の文字列がそのまま実行される（stored XSS）。
 * "<" を "<" に置換することで、script タグとして解釈されなくなる
 * （JSON パーサーは < を通常の "<" として正しく復元するため意味は変わらない）。
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
