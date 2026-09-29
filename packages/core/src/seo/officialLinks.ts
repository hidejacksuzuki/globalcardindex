/**
 * officialLinks.ts — 公式カードデータベースの検索リンク
 *
 * 公式サイトのカード画像は各社の著作物のため取り込まず、カードページからは
 * 公式データベースの検索結果へリンクするだけにする（リンク自体は問題ない）。
 * URL 形式は 2026-09-29 に実際に検索結果が出ることを確認済み。
 */
export function getOfficialSearchUrl(
  game: string | null,
  name: string,
  cardNumber?: string | null,
): string | null {
  switch (game) {
    case "pokemon":
      return `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(name)}&se_ta=&regulation_sidebar_form=all&pg=&illust=&sm_and_keyword=true`;
    case "onepiece":
      // ワンピ公式はカード番号で1件に絞れる（番号が無ければ名前で検索）
      return `https://www.onepiece-cardgame.com/cardlist/?freewords=${encodeURIComponent(cardNumber || name)}`;
    case "yugioh":
      return `https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&keyword=${encodeURIComponent(name)}&request_locale=ja`;
    default:
      return null;
  }
}
