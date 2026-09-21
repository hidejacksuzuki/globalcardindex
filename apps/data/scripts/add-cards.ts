/**
 * add-cards.ts — 新弾カードの一括追加（恒久運用スクリプト）
 *
 * 使い方（apps/data から実行）:
 *   node --env-file=.env.local --import tsx scripts/add-cards.ts           # DRY-RUN（何も書き込まない）
 *   node --env-file=.env.local --import tsx scripts/add-cards.ts --apply   # 実際に投入
 *
 * 仕様:
 *   - CARDS 配列を編集して次の新弾でも再利用する
 *   - 既存カード（name+setName+rarity+condition が一致、削除済み除く）はスキップ（冪等）
 *   - slug は card-requests/convert と同じ規則（slugify 連結 + 衝突時 -2, -3…）
 *   - 追加されたカードは次回の収集クロールから自動で対象になる
 *
 * 履歴:
 *   2026-09-20: ゲーム別ハブ運用開始後の初回新弾追加
 *               （M6 ストームエメラルダ / OP17 世界最強の戦士 / OP16 決戦の刻 /
 *                 BETB BEYOND THE BRAVE / DBGV グロリアス・ヴィクターズ）
 */

import { prisma } from "@gci/db";

/**
 * 既存カードのスラッグ規則に合わせた日本語保持スラッグ。
 * core の slugify は非ASCIIを除去するため日本語カード名が消えて衝突する
 * （既存データは「ゴールdロジャー-op09-新たなる皇帝-…」形式で日本語を保持）。
 * 規則: 小文字化 / 「・」「/」除去 / 空白→ハイフン
 */
function jaSlugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[・/]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type NewCard = {
  game: "pokemon" | "onepiece" | "yugioh" | "mtg";
  setName: string;
  name: string;
  rarity: string;
};

const CARDS: NewCard[] = [
  // ── ポケカ: M6 ストームエメラルダ（2026-07-31発売） ──────────────
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガレックウザex", rarity: "MUR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガレックウザex", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガレックウザex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ライコウex", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ヒガナの信頼", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガゴルーグex", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "カイオーガ", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "グラードン", rarity: "AR" },

  // ── ワンピ: OP17 世界最強の戦士（2026-08-22発売・4周年） ─────────
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ロックス・D・ジーベック", rarity: "海賊団パラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ルフィ", rarity: "海賊団パラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャンクス", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ルフィ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "エドワード・ニューゲート", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "カイドウ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャーロット・リンリン", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ルフィ", rarity: "SPパラレル" },

  // ── ワンピ: OP16 決戦の刻（2026-05-30発売） ──────────────────────
  { game: "onepiece", setName: "OP16 決戦の刻", name: "クザン", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ボルサリーノ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "サカズキ", rarity: "コミパラ" },

  // ── 遊戯王: BETB BEYOND THE BRAVE（2026-07-18発売） ──────────────
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "真紅眼の超越黒竜", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "精霊世妃 ドリアード", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "BEYOND THE BRAVE", rarity: "UR" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "天下独歩の大義賊", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "CX 冀望皇龍カオス・バリアン・ドラゴン", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "宇宙的ハリケーン", rarity: "PSE" },

  // ── 遊戯王: DBGV グロリアス・ヴィクターズ（2026-09-05発売） ──────
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "レイズムーンの帳 シエロ", rarity: "PSE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "セネトの啓示者 ネフェルタリ", rarity: "PSE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "レイズムーンの天 シエロ・ノーモアベット", rarity: "PSE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "セネトナクト・スフィンクス", rarity: "PSE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "虚蝕異解ジャハンナム", rarity: "PSE" },

  // ── sv11B ブラックボルト ──
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ゼクロムex", rarity: "BWR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ゼクロムex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ガマゲロゲ", rarity: "AR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "Nの筋書き", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "キュレムex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ジャローダex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ゲノセクトex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "メロエッタex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ビクティニ", rarity: "AR" },

  // ── sv11W ホワイトフレア ──
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "レシラムex", rarity: "BWR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "レシラムex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "トウコ", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ミジュマル", rarity: "AR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "サザンドラex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ケルディオex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ゾロアーク", rarity: "AR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "トウコ", rarity: "SR" },

  // ── M1L メガブレイブ ──
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガルカリオex", rarity: "MUR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "リーリエの決心", rarity: "SAR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガルカリオex", rarity: "SAR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "リーリエの決心", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガフシギバナex", rarity: "SAR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガアブソルex", rarity: "SAR" },

  // ── M1S メガシンフォニア ──
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガサーナイトex", rarity: "MUR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガサーナイトex", rarity: "SAR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "アセロラのいたずら", rarity: "SAR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガラティアスex", rarity: "SAR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガガルーラex", rarity: "SAR" },

  // ── M2 インフェルノX ──
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガリザードンXex", rarity: "MUR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガリザードンXex", rarity: "SAR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガリザードンXex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "オドリドリex", rarity: "SAR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ヒカリ", rarity: "SAR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガサメハダーex", rarity: "SAR" },

  // ── M3 ムニキスゼロ ──
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガジガルデex", rarity: "MUR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メイのはげまし", rarity: "SAR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ニャースex", rarity: "SAR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガスターミーex", rarity: "SAR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガジガルデex", rarity: "SAR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガピクシーex", rarity: "SAR" },

  // ── M4 ニンジャスピナー ──
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガゲッコウガex", rarity: "MUR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガゲッコウガex", rarity: "SAR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "チラチーノex", rarity: "SAR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガドラミドロex", rarity: "SAR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガフラエッテex", rarity: "SAR" },

  // ── M5 アビスアイ ──
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガダークライex", rarity: "MUR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガダークライex", rarity: "SAR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "モルペコex", rarity: "SAR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ムク", rarity: "SAR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガゼラオラex", rarity: "SAR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガシャンデラex", rarity: "SAR" },

  // ── M6 ストームエメラルダ ──
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ファイアローex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガグソクムシャex", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ギリー", rarity: "SAR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "カクレオン", rarity: "AR" },

  // ── M6a 30th CELEBRATION ──
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウ", rarity: "R/RGB" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウ", rarity: "B/RGB" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウ", rarity: "G/RGB" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウex", rarity: "FUR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウツーex", rarity: "FUR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウツーex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ピカチュウex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ゲンガーex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ルギア", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "リザードン", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ゲンガー", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "コイキング", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ピカチュウ", rarity: "復刻" },

  // ── OP10 王族の血統 ──
  { game: "onepiece", setName: "OP10 王族の血統", name: "トラファルガー・ロー", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP10 王族の血統", name: "エドワード・ニューゲート", rarity: "SP" },
  { game: "onepiece", setName: "OP10 王族の血統", name: "サンジ", rarity: "SP" },
  { game: "onepiece", setName: "OP10 王族の血統", name: "シャーロット・プリン", rarity: "SP" },
  { game: "onepiece", setName: "OP10 王族の血統", name: "神避", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP10 王族の血統", name: "モンキー・D・ルフィ", rarity: "SECパラレル" },

  // ── OP11 神速の拳 ──
  { game: "onepiece", setName: "OP11 神速の拳", name: "モンキー・D・ルフィ", rarity: "3周年SP金" },
  { game: "onepiece", setName: "OP11 神速の拳", name: "モンキー・D・ルフィ", rarity: "3周年SP銀" },
  { game: "onepiece", setName: "OP11 神速の拳", name: "モンキー・D・ルフィ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP11 神速の拳", name: "ギア2", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP11 神速の拳", name: "ルフィ太郎", rarity: "SP" },
  { game: "onepiece", setName: "OP11 神速の拳", name: "シャンクス", rarity: "SP" },

  // ── OP12 師弟の絆 ──
  { game: "onepiece", setName: "OP12 師弟の絆", name: "マーシャル・D・ティーチ", rarity: "3周年SP金" },
  { game: "onepiece", setName: "OP12 師弟の絆", name: "マーシャル・D・ティーチ", rarity: "3周年SP銀" },
  { game: "onepiece", setName: "OP12 師弟の絆", name: "ジュエリー・ボニー", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP12 師弟の絆", name: "鬼気 九刀流 阿修羅 抜剣 亡者戯", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP12 師弟の絆", name: "ゾロ十郎", rarity: "SP" },
  { game: "onepiece", setName: "OP12 師弟の絆", name: "ポートガス・D・エース", rarity: "SP" },

  // ── OP13 受け継がれる意志 ──
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "レッドコミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "レッドコミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "レッドコミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シャンクス", rarity: "3周年SP金" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シャンクス", rarity: "3周年SP銀" },

  // ── OP14 蒼海の七傑 ──
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "バギー", rarity: "3周年SP金" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "バギー", rarity: "3周年SP銀" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジュラキュール・ミホーク", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ボア・ハンコック", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "わらわ こわい・・・?", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "浸食輪廻", rarity: "Rパラレル" },

  // ── EB04 EGGHEAD CRISIS ──
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "コビー", rarity: "コミパラ" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ロロノア・ゾロ", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ゼウス", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "サボ", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ボルサリーノ", rarity: "SRパラレル" },

  // ── OP15 神の島の冒険 ──
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "エネル", rarity: "コミパラ" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ボア・ハンコック", rarity: "SP" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "モンキー・D・ルフィ", rarity: "SP" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "トラファルガー・ロー", rarity: "SP" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ナミ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "雷龍", rarity: "Rパラレル" },

  // ── OP16 決戦の刻 ──
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ミス・オールサンデー", rarity: "SP" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ポートガス・D・エース", rarity: "SP" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ゼハハハハハハ!!!", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "マーシャル・D・ティーチ", rarity: "SECパラレル" },

  // ── OP17 世界最強の戦士 ──
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャンクス", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ロロノア・ゾロ", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "マーシャル・D・ティーチ", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ヤマト", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "光月おでん", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "カイドウ", rarity: "SRパラレル" },

  // ── LOCH LIMIT OVER COLLECTION ──
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "黒魔導のカーテン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "王のしもべ－ブラック・マジシャン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "マルチャミー・フワロス", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "ガガガガール－ゼロゼロコール", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "W:Pファンシーボール", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "S:Pリトルナイト", rarity: "PSE" },

  // ── CORI CHAOS ORIGINS ──
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "CHAOS ORIGINS", rarity: "UR" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "黒き混沌の魔術師ブラック・カオス", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "始まりの神ファーラ", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "光と闇の戦士カオス・ソルジャー", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "混沌の三幻魔", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "怠慢な壺", rarity: "PSE" },

  // ── RV01 REVOLUTION BOOSTER ──
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "トゥーン・ブラック・マジシャン・ガール", rarity: "OFSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "ブルーアイズ・トゥーン・ドラゴン", rarity: "OFSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "ブルーアイズ・トゥーン・アルティメット・ドラゴン", rarity: "PSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "ウィッチクラフトマスター・ヴェール", rarity: "OFSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "完全なる世界トゥーンワールド", rarity: "PSE" },

  // ── WPP7 WORLD PREMIERE PACK 2026 ──
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "闘者を導く光", rarity: "EXSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "不死の大軍団", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "貴婦人の守護者", rarity: "EXSE" },

  // ── BETB BEYOND THE BRAVE ──
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "トラップトリック", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "封神の剣鬼 ミクマリ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "鬼神 水子守命", rarity: "PSE" },

  // ── 25DB PRISMATIC SUMMON ──
  { game: "yugioh", setName: "25DB PRISMATIC SUMMON", name: "共命の翼ガルーラ", rarity: "PSE" },
  { game: "yugioh", setName: "25DB PRISMATIC SUMMON", name: "水晶機巧－ハリファイバー", rarity: "PSE" },

  // ── M6a 30th CELEBRATION（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ホゲータex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ゲッコウガex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ニンフィアex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ジラーチex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ボーマンダex", rarity: "SAR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "アローラナッシー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ファイヤー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ラプラス", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "フリーザー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "サンダー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ストリンダー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "モルペコ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "フワンテ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "シャンデラ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ルガルガン", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ニドリーナ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "アローラニャース", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ズルッグ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ガラルニャース", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "サーフゴー", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ジャラランガ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ニャース", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "メタモン", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ヒスイゾロア", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "イッカネズミ", rarity: "AR" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "カスミ", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "エリカのプリン", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ニューラ", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ひかるセレビィ", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "エネコロロ", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "わるいバンギラス", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ハッサムex", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "メタグロス", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "パルキア", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ユクシー", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "クロバットG", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ダークライ&クレセリアLEGEND", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "N", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "レックウザEX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ゲノセクトEX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "MサーナイトEX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ゲッコウガBREAK", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ソルガレオGX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "マッシブーンGX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ピカチュウ&ゼクロムGX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ザシアンV", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ライコウ", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "ミュウVMAX", rarity: "復刻" },
  { game: "pokemon", setName: "M6a 30th CELEBRATION", name: "アルセウスVSTAR", rarity: "復刻" },

  // ── M6 ストームエメラルダ（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガグソクムシャex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ヒートロトムex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ヨワシex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ライコウex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガゴルーグex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "メガカラマネロex", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ギリー", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ヒガナの信頼", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "フウとランの修行", rarity: "SR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "アメモース", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ガーディ", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ブーバーン", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "エレキブル", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "バチンウニ", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ラブトロス", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "マーイーカ", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "ルリリ", rarity: "AR" },
  { game: "pokemon", setName: "M6 ストームエメラルダ", name: "チルタリス", rarity: "AR" },

  // ── M5 アビスアイ（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M5 アビスアイ", name: "グラジオの決戦", rarity: "SAR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ラランテスex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ホエルオーex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガゼラオラex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガシャンデラex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ラムパルドex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガダークライex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "モルペコex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "メガドリュウズex", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "カスミの元気", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "グラジオの決戦", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ムク", rarity: "SR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "カリキリ", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "グレンアルマ", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "トサキント", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "アシレーヌ", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ライボルト", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ヤドラン", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ダダリン", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "フォクスライ", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ザルード", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "トリデプス", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "ドデカバシ", rarity: "AR" },
  { game: "pokemon", setName: "M5 アビスアイ", name: "シルヴァディ", rarity: "AR" },

  // ── M4 ニンジャスピナー（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "AZの安らぎ", rarity: "SAR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ホミカの演奏", rarity: "SAR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "スピアーex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガカエンジシex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガゲッコウガex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガフラエッテex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "パンプジンex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "コバルオンex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メガドラミドロex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "チラチーノex", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "AZの安らぎ", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ホミカの演奏", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "マチエール", rarity: "SR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ハリマロン", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ゲコガシラ", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "デンリュウ", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ゼルネアス", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ネンドール", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "クロバット", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "メタング", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ヌメイル", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ケンタロス", rarity: "AR" },
  { game: "pokemon", setName: "M4 ニンジャスピナー", name: "ミルホッグ", rarity: "AR" },

  // ── M3 ムニキスゼロ（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ユカリ", rarity: "SAR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ジュナイパーex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "エンニュートex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガスターミーex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガピクシーex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガジガルデex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "イベルタルex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メガエアームドex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ニャースex", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "メイのはげまし", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ユカリ", rarity: "SR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "コフーライ", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "モクロー", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ファイアロー", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "アマルルガ", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "デデンネ", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ニャスパー", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ダイノーズ", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "チゴラス", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ドラピオン", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ニダンギル", rarity: "AR" },
  { game: "pokemon", setName: "M3 ムニキスゼロ", name: "ラッタ", rarity: "AR" },

  // ── M2 インフェルノX（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M2 インフェルノX", name: "ロトムex", rarity: "SAR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガミミロップex", rarity: "SAR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガヘラクロスex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "オドリドリex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ロトムex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ムウマージex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガサメハダーex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "エンペルトex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "メガミミロップex", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ヒカリ", rarity: "SR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ルンパッパ", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "マメバッタ", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "カルボウ", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ジュゴン", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ワンパチ", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "ザシアン", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "フライゴン", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "トゲデマル", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "プクリン", rarity: "AR" },
  { game: "pokemon", setName: "M2 インフェルノX", name: "エテボース", rarity: "AR" },

  // ── M1L メガブレイブ（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M1L メガブレイブ", name: "マチスの取引", rarity: "SAR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガフシギバナex", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガバクーダex", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガルカリオex", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガアブソルex", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "メガクチートex", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "マチスの取引", rarity: "SR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "ナッシー", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "リオル", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "マーシャドー", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "キョジオーン", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "ミカルゲ", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "ハガネール", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "オニスズメ", rarity: "AR" },
  { game: "pokemon", setName: "M1L メガブレイブ", name: "デカグース", rarity: "AR" },

  // ── M1S メガシンフォニア（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ミツルの思いやり", rarity: "SAR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガユキノオーex", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガライボルトex", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガサーナイトex", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガラティアスex", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "メガガルーラex", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "アセロラのいたずら", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ミツルの思いやり", rarity: "SR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "テッカニン", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "シシコ", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ユキカブリ", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ブロスター", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "インテレオン", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "エリキテル", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ヌケニン", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ハカドッグ", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "デリバード", rarity: "AR" },
  { game: "pokemon", setName: "M1S メガシンフォニア", name: "ヌイコグマ", rarity: "AR" },

  // ── sv11B ブラックボルト（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ドリュウズex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ジャローダex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "キュレムex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ゼクロムex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "メロエッタex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ドリュウズex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "ゲノセクトex", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "Nの筋書き", rarity: "SR" },
  { game: "pokemon", setName: "sv11B ブラックボルト", name: "マコモ", rarity: "SR" },

  // ── sv11W ホワイトフレア（全種拡充 2026-09-21） ──
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ブルンゲルex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "エルフーンex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "バッフロンex", rarity: "SAR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "エルフーンex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "レシラムex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ケルディオex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "ブルンゲルex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "サザンドラex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "バッフロンex", rarity: "SR" },
  { game: "pokemon", setName: "sv11W ホワイトフレア", name: "クラウン", rarity: "SR" },

  // ── OP17 世界最強の戦士（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ロックス・D・ジーベック", rarity: "SEC" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ロキ", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ガープ", rarity: "SP" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "エドワード・ニューゲート", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャンクス", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ヤソップ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "グロリオーサ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シキ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ウソップ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ルフィ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャーロット・リンリン", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ベン・ベックマン", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "そんなに怖いか？「新時代」が!!!", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャーロット・リンリン", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ミス・バッキンガム・ステューシー", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "大看板", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ニコ・ロビン", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "スイート3将星", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "エドワード・ニューゲート", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャンクス", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "ロックス・D・ジーベック", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "カイドウ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "モンキー・D・ルフィ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP17 世界最強の戦士", name: "シャーロット・リンリン", rarity: "Lパラレル" },

  // ── OP16 決戦の刻（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ポートガス・D・エース", rarity: "SEC" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ポートガス・D・エース", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "マーシャル・D・ティーチ", rarity: "SEC" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "キャベンディッシュ", rarity: "SP" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ポートガス・D・エース", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "モンキー・D・ルフィ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "バギー", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "センゴク", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ヤマト", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "マーシャル・D・ティーチ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "エドワード・ニューゲート", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "モンキー・D・ルフィ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "エンポリオ・イワンコフ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ボア・ハンコック", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "バギー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "Mr.3（ギャルディーノ）", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "サカズキ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "錦えもん", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ヤマト", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "シリュウ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "マルコ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "モビー・ディック号", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "モンキー・D・ルフィ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "Mr.2・ボン・クレー（ベンサム）", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "クザン", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "ボルサリーノ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP16 決戦の刻", name: "光月モモの助", rarity: "Rパラレル" },

  // ── OP15 神の島の冒険（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "エネル", rarity: "SEC" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "エネル", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "モンキー・D・ルフィ", rarity: "SEC" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "モンキー・D・ルフィ", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "サボ", rarity: "SP" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "クリーク", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ルーシー", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ブルック", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "レベッカ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "エネル", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "モンキー・D・ルフィ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ギン", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "クリーク", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ブルック", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "サボ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "レベッカ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "エネル", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "万雷", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ロロノア・ゾロ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ワイパー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "アルビダ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "クロ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "サンジ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "オーム", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "モンキー・D・ルフィ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP15 神の島の冒険", name: "ニコ・ロビン", rarity: "Rパラレル" },

  // ── EB04 EGGHEAD CRISIS（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "モンキー・D・ルフィ", rarity: "SEC" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "モンキー・D・ルフィ", rarity: "SECパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "エドワード・ウィーブル", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "スモーカー＆たしぎ", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ユースタス・キッド", rarity: "SP" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "菊之丞", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "キャロット", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ネフェルタリ・ビビ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "フォクシー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ロシナンテ＆ロー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "コビー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ロブ・ルッチ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "ジュエリー・ボニー", rarity: "Rパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "メガロ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "イッショウ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "キング", rarity: "Rパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "カク", rarity: "Rパラレル" },
  { game: "onepiece", setName: "EB04 EGGHEAD CRISIS", name: "サンジ", rarity: "Rパラレル" },

  // ── OP14 蒼海の七傑（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジュラキュール・ミホーク", rarity: "SEC" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジュラキュール・ミホーク", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "クロコダイル", rarity: "SEC" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "クロコダイル", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジュラキュール・ミホーク", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ペローナ", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "センゴク", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "シュガー", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "キッド&キラー", rarity: "SP" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "トラファルガー・ロー", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジュラキュール・ミホーク", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジンベエ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ボア・ハンコック", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ドンキホーテ・ドフラミンゴ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "クロコダイル", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ゲッコー・モリア", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "トラファルガー・ロー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "モンキー・D・ルフィ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ナミ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ペローナ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ジンベエ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ドンキホーテ・ドフラミンゴ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ミス・オールサンデー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "Mr.2・ボン・クレー（ベンサム）", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ゲッコー・モリア", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ボア・ハンコック", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ロロノア・ゾロ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "シャンクス", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "アーロン", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ヴェルゴ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "Mr.1（ダズ・ボーネス）", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP14 蒼海の七傑", name: "ペローナ", rarity: "Rパラレル" },

  // ── OP13 受け継がれる意志（全種拡充 2026-09-21） ──
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "SEC" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "SEC" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "SEC" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "SECパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ゴール・D・ロジャー", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ベン・ベックマン", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "スモーカー", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "リリス", rarity: "SP" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ルフィ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ポートガス・D・エース", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ゴール・D・ロジャー", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サボ", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "イム", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ジュエリー・ボニー", rarity: "Lパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "エース＆サボ＆ルフィ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ウタ", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シャンクス", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "エドワード・ニューゲート", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ヤマト", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ゴール・D・ロジャー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シルバーズ・レイリー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "五老星", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ジュエリー・ボニー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ステューシー", rarity: "SRパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "モンキー・D・ガープ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "サンジ", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ボア・ハンコック", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シャンクス", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "神避", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "ジェイガルシア・サターン聖", rarity: "特別パラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "シェパード・十・ピーター聖", rarity: "特別パラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "トップマン・ウォーキュリー聖", rarity: "特別パラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "マーカス・マーズ聖", rarity: "特別パラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "リリス", rarity: "Rパラレル" },
  { game: "onepiece", setName: "OP13 受け継がれる意志", name: "S-スネーク", rarity: "Rパラレル" },

  // ── BETB BEYOND THE BRAVE（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "疾風の豹戦士パンサーウォリアー", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "ゴルゴニック・アンブラル", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "金神の戦鬼 アカスナ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "アトランティスの竜神－ダイダロス", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "アトランティスの妖渦", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "予幻使 メディウス", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "無限と有限のアルス＝マグナ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "D-HERO デスドグマガイ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "D-HERO デビルロードガイ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "結束の悪魔竜ブラック・デーモンズ・ドラゴン", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "鬼神 朱沙之王", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "No.104 仮面魔踏士シャイニングV", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "蒼海竜神－ネオダイダロス・レイジ", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "魔救の輝跡", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "時の黒魔術師", rarity: "PSE" },
  { game: "yugioh", setName: "BETB BEYOND THE BRAVE", name: "炎舞－「天璣」", rarity: "PSE" },

  // ── DBGV グロリアス・ヴィクターズ（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "狂嵐異解プルートニオン", rarity: "PSE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "タウセネト・アジャト", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "光帰への契り", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "光帰の旅－『セネト』", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "レイズムーンの朔 スクイーズ", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "レイズムーンの星々", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "緋ノ異解ナラカ", rarity: "SE" },
  { game: "yugioh", setName: "DBGV グロリアス・ヴィクターズ", name: "葬嶺異解ヴェルヘイム", rarity: "SE" },

  // ── CORI CHAOS ORIGINS（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "劫火の三幻魔－神炎皇ウリア", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "罪禍の三幻魔－降雷皇ハモン", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "無窮の三幻魔－幻魔皇ラビエル", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "ウィスカ・ブリッツクリーク", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "サージ・ブリッツクリーク", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "クラック・ブリッツクリーク", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "追憶のアレイスター", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "メルフィー・ラビィーズ", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "繋星の雷后", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "超越召喚獣アイオーン", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "誇り高き耀聖の詩－エルフェンノーツ", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "幻影騎士団マレヴォレンスサイス", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "S－Force ナイトスレイヤー", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "召喚魔術－「剣」", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "予幻なき日々のまぼろし", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "時空穿つ遡光", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "儀式の下準備", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "ライオウ", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "聖魔の乙女アルテミス", rarity: "PSE" },
  { game: "yugioh", setName: "CORI CHAOS ORIGINS", name: "幻影霧剣", rarity: "PSE" },

  // ── RV01 REVOLUTION BOOSTER（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械雙王神ライゴウ", rarity: "OFSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械神王ヤマ", rarity: "OFSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "ウィッチクラフト・テラコッタン", rarity: "PSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械式鬼シャラ", rarity: "PSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械式鬼シュマ", rarity: "PSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械冥官カムラ", rarity: "PSE" },
  { game: "yugioh", setName: "RV01 REVOLUTION BOOSTER", name: "破械焔魔天ヤマ", rarity: "PSE" },

  // ── WPP7 WORLD PREMIERE PACK 2026（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "墓場のゴースト王－パンプキング－", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "ゴースト大王－パンプキング－", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "生ける屍の呼び声", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "R.B.ブルート・ブルース", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "GMX－ALLOS", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "GMX－VELOX", rarity: "PSE" },
  { game: "yugioh", setName: "WPP7 WORLD PREMIERE PACK 2026", name: "宵闇のルーチェ", rarity: "PSE" },

  // ── LOCH LIMIT OVER COLLECTION（全種拡充 2026-09-21） ──
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "増殖するクリボー！", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "F・HERO シャイニング・フレア・ウィングマン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "F・HERO フレイム・ウィングマン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "ハネクリボー・サバティエル LV10", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "スタージャンク・シンクロン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "シンクロ・エマージェンシー", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "No.39 光の使者 希望皇ホープ", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "ガガガマジシャン－ガガガマジック", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "四天の龍 オッドアイズ・ペンデュラム・ドラゴン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "星読みの魔術師－ホロスコープ・マジシャン", rarity: "PSE" },
  { game: "yugioh", setName: "LOCH LIMIT OVER COLLECTION", name: "星霜の魔術師－アストログラフ・マジシャン", rarity: "PSE" },
];

const CONDITION = "NM";
const APPLY = process.argv.includes("--apply");

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || "card";
  const existing = await prisma.card.findUnique({ where: { slug: candidate }, select: { id: true } });
  if (!existing) return candidate;
  let n = 2;
  for (;;) {
    const s = `${candidate}-${n}`;
    const ex = await prisma.card.findUnique({ where: { slug: s }, select: { id: true } });
    if (!ex) return s;
    n++;
  }
}

async function main() {
  console.log(`mode: ${APPLY ? "APPLY（本番投入）" : "DRY-RUN（書き込みなし）"}  対象 ${CARDS.length}枚\n`);
  let added = 0;
  let skipped = 0;

  for (const c of CARDS) {
    const dup = await prisma.card.findFirst({
      where: { name: c.name, setName: c.setName, rarity: c.rarity, condition: CONDITION, deletedAt: null },
      select: { id: true },
    });
    if (dup) {
      console.log(`  skip（既存）: [${c.game}] ${c.setName} / ${c.name} (${c.rarity})`);
      skipped++;
      continue;
    }

    const slugBase = [c.name, c.setName, c.rarity, CONDITION].map(jaSlugify).filter(Boolean).join("-");
    const slug = await uniqueSlug(slugBase);

    if (APPLY) {
      const card = await prisma.card.create({
        data: { name: c.name, setName: c.setName, rarity: c.rarity, condition: CONDITION, game: c.game, slug },
        select: { id: true },
      });
      console.log(`  ADD: [${c.game}] ${c.setName} / ${c.name} (${c.rarity}) → ${slug} (${card.id})`);
    } else {
      console.log(`  add予定: [${c.game}] ${c.setName} / ${c.name} (${c.rarity}) → ${slug}`);
    }
    added++;
  }

  console.log(`\n結果: 追加${APPLY ? "" : "予定"} ${added}枚 / スキップ ${skipped}枚`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
