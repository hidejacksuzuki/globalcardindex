/**
 * scripts/seed-ja-aliases.ts
 *
 * 英語名カード（ポケモン・ワンピース）に日本語名の CardAlias(locale:"ja") を
 * 登録する。ヤフオク収集の検索キーワードと本人確認（auctionIdentityHit）が
 * 日本語エイリアスを使えるようにするための種データ。
 *
 * - 対象はカード名（Card.name）単位。同名カードすべてに付与される
 * - 既に同名の ja エイリアスがあるカードはスキップ（冪等）
 * - MTG は対象外（ヤフオクでも英語名表記が通例で、name 照合が機能している）
 *
 * デフォルト DRY-RUN。書き込みは --apply。
 *
 * 実行（apps/data から）:
 *   node --env-file=.env.local --import tsx scripts/seed-ja-aliases.ts
 *   node --env-file=.env.local --import tsx scripts/seed-ja-aliases.ts --apply
 */

import { prisma } from "@gci/db";

const APPLY = process.argv.includes("--apply");

/** Card.name（英語） → 日本語エイリアス（複数可）。 */
const JA_ALIASES: Record<string, string[]> = {
  // ── ポケモン ──────────────────────────────────────────────
  "Arceus VSTAR":   ["アルセウスVSTAR"],
  "Charizard":      ["リザードン"],
  "Charizard ex":   ["リザードンex"],
  "Flareon ex":     ["ブースターex"],
  "Gardevoir ex":   ["サーナイトex"],
  "Gengar ex":      ["ゲンガーex"],
  "Glaceon ex":     ["グレイシアex"],
  "Glaceon VMAX":   ["グレイシアVMAX"],
  "Iono":           ["ナンジャモ"],
  "Jolteon ex":     ["サンダースex"],
  "Leafeon ex":     ["リーフィアex"],
  "Leafeon VMAX":   ["リーフィアVMAX"],
  "Lugia":          ["ルギア"],
  "Lugia VSTAR":    ["ルギアVSTAR"],
  "Mew ex":         ["ミュウex"],
  "Mewtwo ex":      ["ミュウツーex"],
  "Miraidon ex":    ["ミライドンex"],
  "Pikachu ex":     ["ピカチュウex"],
  "Rayquaza VMAX":  ["レックウザVMAX"],
  "Sylveon ex":     ["ニンフィアex"],
  "Umbreon":        ["ブラッキー"],
  "Umbreon ex":     ["ブラッキーex"],
  "Umbreon VMAX":   ["ブラッキーVMAX"],
  "Vaporeon ex":    ["シャワーズex"],
  // ── ワンピース ────────────────────────────────────────────
  "Charlotte Linlin": ["シャーロット・リンリン"],
  "Gol D. Roger":     ["ゴール・D・ロジャー"],
  "Kaido":            ["カイドウ"],
  "Monkey D. Luffy":  ["モンキー・D・ルフィ"],
  "Portgas D. Ace":   ["ポートガス・D・エース"],
  "Sabo":             ["サボ"],
  "Shanks":           ["シャンクス"],
  "Trafalgar Law":    ["トラファルガー・ロー"],
  "Vinsmoke Sanji":   ["ヴィンスモーク・サンジ", "サンジ"],
  "Whitebeard":       ["エドワード・ニューゲート", "白ひげ"],
  "Yamato":           ["ヤマト"],
};

async function main() {
  console.log(`モード: ${APPLY ? "★APPLY（本番書き込み）" : "DRY-RUN"}`);

  const cards = await prisma.card.findMany({
    where:  { name: { in: Object.keys(JA_ALIASES) }, deletedAt: null },
    select: {
      id: true, name: true, setName: true, condition: true,
      aliases: { where: { locale: "ja" }, select: { name: true } },
    },
  });

  let created = 0, skipped = 0, missing = 0;
  const seenNames = new Set(cards.map((c) => c.name));
  for (const key of Object.keys(JA_ALIASES)) {
    if (!seenNames.has(key)) { console.log(`  ⚠ カード未存在: ${key}`); missing++; }
  }

  for (const card of cards) {
    const existing = new Set(card.aliases.map((a) => a.name));
    for (const ja of JA_ALIASES[card.name] ?? []) {
      if (existing.has(ja)) { skipped++; continue; }
      console.log(`  + ${card.name} (${card.setName}/${card.condition}) ← 「${ja}」`);
      created++;
      if (!APPLY) continue;
      await prisma.cardAlias.create({
        data: {
          cardId:   card.id,
          locale:   "ja",
          name:     ja,
          language: "Japanese",
          market:   "JP",
        },
      });
    }
  }

  console.log(`\n対象カード ${cards.length} / 追加${APPLY ? "" : "予定"} ${created} / 既存スキップ ${skipped} / 名前未存在 ${missing}`);
  if (!APPLY) console.log("--apply で書き込み。");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
