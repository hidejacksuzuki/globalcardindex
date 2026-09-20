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
