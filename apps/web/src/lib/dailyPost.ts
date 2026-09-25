import type { MarketboardRow } from '@gci/core';

/**
 * dailyPost.ts — X毎日投稿の「新弾ピックアップ」設定
 *
 * 投稿文面と添付画像の主役にする「いま推す新弾セット」。新弾が出たら
 * ここを書き換えるだけで投稿内容が切り替わる（先頭のセットが優先）。
 * ハッシュタグはセット名での検索流入を狙って付ける。
 */
export const FEATURED_SETS: Record<string, { setNames: string[]; hashtag: string }> = {
  pokemon: {
    setNames: ['M6a 30th CELEBRATION', 'M6 ストームエメラルダ'],
    hashtag:  '#30thCELEBRATION',
  },
  onepiece: {
    setNames: ['OP17 世界最強の戦士', 'OP16 決戦の刻'],
    hashtag:  '#OP17',
  },
  yugioh: {
    setNames: ['DBGV グロリアス・ヴィクターズ', 'BETB BEYOND THE BRAVE'],
    hashtag:  '#グロリアスヴィクターズ',
  },
};

/**
 * 新弾セットの注目カードを最新価格の高い順に返す。
 * 発売直後は30日変動が計算できないカードが多いため、価格ベースで選ぶ。
 */
export function pickNewSetCards(rows: MarketboardRow[], game: string, n = 3): MarketboardRow[] {
  const featured = FEATURED_SETS[game]?.setNames ?? [];
  return rows
    .filter((r) => featured.includes(r.setName) && r.latestPrice !== null)
    .sort((a, b) => b.latestPrice! - a.latestPrice!)
    .slice(0, n);
}
