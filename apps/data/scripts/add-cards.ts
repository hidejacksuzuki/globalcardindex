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
