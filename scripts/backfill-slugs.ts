/**
 * backfill-slugs.ts
 *
 * Card テーブルの game / slug を一括バックフィルするスクリプト。
 *
 * 使い方:
 *   npm run backfill-slugs           # 実行
 *   npm run backfill-slugs -- --dry  # ドライラン（DB変更なし）
 *
 * 出力例:
 *   [dry-run] updated: 532  skipped: 12  duplicates resolved: 8
 */

import { PrismaClient } from "@prisma/client";
import { slugify }      from "../src/lib/seo/slugify";

const prisma = new PrismaClient();
const isDry  = process.argv.includes("--dry");

// ----------------------------------------------------------------
// Game 推定ヒューリスティック
//
// setName / name から game キーを推定する。
// 順序は「より特異なパターンを先に」で書く（OR条件を広げてから絞る）。
// ----------------------------------------------------------------

type GameKey = "pokemon" | "onepiece" | "yugioh" | "mtg";

const GAME_RULES: Array<{
  game:     GameKey;
  patterns: RegExp[];   // setName OR name いずれかにマッチすれば採用
}> = [
  {
    game: "pokemon",
    patterns: [
      /pokemon/i,
      /ポケモン|ポケカ/,
      /\bSV\d/i,           // SV1, SV4a など
      /\bBW\d/i,
      /\bXY\d/i,
      /\bSM\d/i,
      /scarlet.violet/i,
      /sword.shield/i,
      /sun.moon/i,
      /base.set/i,
      /fossil/i,
      /jungle/i,
      /neo/i,
    ],
  },
  {
    game: "onepiece",
    patterns: [
      /one.?piece/i,
      /ワンピース|OP-\d/,
      /\bOP\d{2}/,         // OP01, OP02 ...
    ],
  },
  {
    game: "yugioh",
    patterns: [
      /yu-?gi-?oh/i,
      /遊戯王|YGO/i,
      /master.duel/i,
      /\b(DUSA|AGOV|LEDE|PHNI)\b/i,  // 遊戯王パックコード
    ],
  },
  {
    game: "mtg",
    patterns: [
      /magic.*(gathering|the)/i,
      /\bmtg\b/i,
      /マジック.*ザ.*ギャザリング/,
      /\b(MH[123]|LCI|WOE|MOM|ONE|BRO)\b/i,  // MTG セットコード
    ],
  },
];

function inferGame(setName: string, cardName: string): GameKey | null {
  const haystack = `${setName} ${cardName}`;
  for (const rule of GAME_RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) {
      return rule.game;
    }
  }
  return null;
}

// ----------------------------------------------------------------
// Slug 生成
//
// `name + setName` を使う（setName は短縮形が入ることを想定）。
// rarity / condition は末尾に付与して uniqueness を高める。
// ----------------------------------------------------------------

/**
 * セット名から「短いコード」を抽出する。
 *
 * e.g. "Scarlet & Violet – Twilight Masquerade (SV6)" → "sv6"
 *      "OP-04 Kingdoms of Intrigue"                  → "op-04"
 *      "Base Set"                                     → "base-set"
 */
function setCode(setName: string): string {
  // 括弧内のコード (SV4a, OP01, MH3, ...) を優先
  const codeMatch = setName.match(/\(([A-Za-z0-9\-]+)\)/);
  if (codeMatch) return slugify(codeMatch[1]);

  // OP-XX / OPxx 形式
  const opMatch = setName.match(/\b(OP[-\s]?\d{2,3})\b/i);
  if (opMatch) return slugify(opMatch[1]);

  // SV4a / BW2 のようなセットコード（先頭にある場合）
  const shortCode = setName.match(/^([A-Z]{1,4}[-\s]?\d{1,3}[A-Za-z]?)\b/);
  if (shortCode) return slugify(shortCode[1]);

  // フォールバック: セット名全体をスラッグ化（先頭 3 単語まで）
  return slugify(setName.split(/\s+/).slice(0, 3).join(" "));
}

function buildSlug(name: string, setName: string, rarity: string, condition: string): string {
  const namePart = slugify(name);
  const setPart  = setCode(setName);
  const rarePart = slugify(rarity);
  const condPart = slugify(condition);

  // name-setcode-rarity-condition の形式
  // 各パートが空の場合はスキップ
  return [namePart, setPart, rarePart, condPart]
    .filter(Boolean)
    .join("-");
}

// ----------------------------------------------------------------
// 重複解決
//
// 生成したスラッグが既に使われている場合、-1 / -2 ... を付与する。
// ----------------------------------------------------------------

function resolveConflict(base: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let suffix = 1;
  while (usedSlugs.has(`${base}-${suffix}`)) {
    suffix++;
  }
  const resolved = `${base}-${suffix}`;
  usedSlugs.add(resolved);
  return resolved;
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

async function main() {
  console.log(isDry ? "🔍 [dry-run] slug backfill を開始します" : "🚀 slug backfill を開始します");

  // slug が未設定のカードのみ対象
  const cards = await prisma.card.findMany({
    where: { slug: null },
    select: {
      id:        true,
      name:      true,
      setName:   true,
      rarity:    true,
      condition: true,
      game:      true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (cards.length === 0) {
    console.log("✅ バックフィル対象のカードが見つかりませんでした（全カードに slug 設定済み）");
    return;
  }

  console.log(`対象カード: ${cards.length} 件`);

  // DB に既存の slug を全て読み込み（重複チェック用）
  const existingSlugs = await prisma.card.findMany({
    where:  { slug: { not: null } },
    select: { slug: true },
  });
  const usedSlugs = new Set(existingSlugs.map((c) => c.slug!));

  // 集計
  let updated           = 0;
  let skipped           = 0;
  let gameInferred      = 0;
  let duplicatesResolved = 0;

  const updates: Array<{ id: string; slug: string; game: string | null }> = [];

  for (const card of cards) {
    const baseSlug = buildSlug(card.name, card.setName, card.rarity, card.condition);

    if (!baseSlug) {
      // スラッグが生成できなかった（全角文字のみのカード名など）
      console.warn(`  ⚠ slug 生成失敗: id=${card.id} name="${card.name}"`);
      skipped++;
      continue;
    }

    // 重複解決
    const slug = resolveConflict(baseSlug, usedSlugs);
    if (slug !== baseSlug) {
      duplicatesResolved++;
      if (isDry) console.log(`  🔁 conflict resolved: "${baseSlug}" → "${slug}"`);
    }

    // game 推定（未設定のみ）
    let game = card.game;
    if (!game) {
      const inferred = inferGame(card.setName, card.name);
      if (inferred) {
        game = inferred;
        gameInferred++;
      }
    }

    updates.push({ id: card.id, slug, game });
    updated++;

    if (isDry && updated <= 20) {
      // ドライラン時は最初の20件だけ詳細表示
      console.log(`  → "${card.name}" (${card.setName}) : slug="${slug}" game=${game ?? "null"}`);
    }
  }

  if (isDry && updated > 20) {
    console.log(`  ... (他 ${updated - 20} 件 — --dry では先頭 20 件のみ表示)`);
  }

  // 実行
  if (!isDry && updates.length > 0) {
    // バッチサイズ 200 件ずつ更新（DB 負荷軽減）
    const BATCH = 200;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map(({ id, slug, game }) =>
          prisma.card.update({
            where:  { id },
            data:   { slug, ...(game ? { game } : {}) },
          }),
        ),
      );
      const progress = Math.min(i + BATCH, updates.length);
      process.stdout.write(`\r  更新中... ${progress} / ${updates.length}`);
    }
    console.log(); // 改行
  }

  // サマリー
  const label = isDry ? "[dry-run] " : "";
  console.log("");
  console.log(`✅ ${label}完了`);
  console.log(`   updated:            ${updated}`);
  console.log(`   skipped:            ${skipped}`);
  console.log(`   game inferred:      ${gameInferred}`);
  console.log(`   duplicates resolved: ${duplicatesResolved}`);
}

main()
  .catch((e) => {
    console.error("❌ エラー:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
