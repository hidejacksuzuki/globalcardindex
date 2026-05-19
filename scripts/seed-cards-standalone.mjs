/**
 * scripts/seed-cards-standalone.mjs
 *
 * Standalone seed script — no workspace dependencies required.
 * Uses @prisma/client directly from pnpm store.
 *
 * Usage (from monorepo root):
 *   node scripts/seed-cards-standalone.mjs            # upsert all cards
 *   node scripts/seed-cards-standalone.mjs --dry      # dry run
 *   node scripts/seed-cards-standalone.mjs --game=yugioh
 */

import { createRequire } from "node:module";
import { resolve }       from "node:path";
import { readFileSync }  from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT      = resolve(__dirname, "..");

// ── Resolve @prisma/client from pnpm store ────────────────────────────────────
const require = createRequire(import.meta.url);
const prismaClientPath = resolve(
  ROOT,
  "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client",
);
const { PrismaClient } = require(prismaClientPath);

// ── Load .env.local ───────────────────────────────────────────────────────────
try {
  const env = readFileSync(resolve(ROOT, "apps/web/.env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // .env.local not found — expect DATABASE_URL in environment
}

const prisma = new PrismaClient();

// ── Card data ─────────────────────────────────────────────────────────────────

const POKEMON = [
  // SV2a: ポケモンカード151
  { game: "pokemon", name: "Charizard ex",   setName: "SV2a 151",         rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Charizard ex",   setName: "SV2a 151",         rarity: "SAR", condition: "LP" },
  { game: "pokemon", name: "Mewtwo ex",      setName: "SV2a 151",         rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Pikachu ex",     setName: "SV2a 151",         rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Mew ex",         setName: "SV2a 151",         rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Gengar ex",      setName: "SV2a 151",         rarity: "SAR", condition: "NM" },
  // SV3: 黒炎の支配者
  { game: "pokemon", name: "Charizard ex",   setName: "SV3 黒炎の支配者", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Charizard ex",   setName: "SV3 黒炎の支配者", rarity: "SAR", condition: "LP" },
  { game: "pokemon", name: "Charizard ex",   setName: "SV3 黒炎の支配者", rarity: "SR",  condition: "NM" },
  // SV4a: シャイニートレジャーex
  { game: "pokemon", name: "Pikachu ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Umbreon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Sylveon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Glaceon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Leafeon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Flareon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Vaporeon ex",    setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "Jolteon ex",     setName: "SV4a シャイニートレジャーex", rarity: "SSR", condition: "NM" },
  // SV2: クレイバースト
  { game: "pokemon", name: "Iono",           setName: "SV2 クレイバースト", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Iono",           setName: "SV2 クレイバースト", rarity: "SAR", condition: "LP" },
  // SV1S/SV1V
  { game: "pokemon", name: "Gardevoir ex",   setName: "SV1S バイオレット", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Miraidon ex",    setName: "SV1 スカーレット",  rarity: "SAR", condition: "NM" },
  // SWSH
  { game: "pokemon", name: "Umbreon VMAX",   setName: "SWSH6 Evolving Skies",  rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Glaceon VMAX",   setName: "SWSH6 Evolving Skies",  rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Leafeon VMAX",   setName: "SWSH6 Evolving Skies",  rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Rayquaza VMAX",  setName: "SWSH6 Evolving Skies",  rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Lugia VSTAR",    setName: "SWSH11 Lost Origin",    rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "Arceus VSTAR",   setName: "SWSH9 Brilliant Stars", rarity: "SAR", condition: "NM" },
  // Base Set / Classics
  { game: "pokemon", name: "Charizard",      setName: "Base Set",  rarity: "Holo Rare", condition: "NM" },
  { game: "pokemon", name: "Charizard",      setName: "Base Set",  rarity: "Holo Rare", condition: "LP" },
  { game: "pokemon", name: "Lugia",          setName: "Neo Genesis", rarity: "Holo Rare", condition: "NM" },
  { game: "pokemon", name: "Umbreon",        setName: "Neo Discovery", rarity: "Holo Rare", condition: "NM" },
];

const POKEMON_JP = [
  // SV era trainers
  { game: "pokemon", name: "ナンジャモ",       setName: "sv2D", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "ナンジャモ",       setName: "sv2D", rarity: "SAR", condition: "LP" },
  { game: "pokemon", name: "ナンジャモ",       setName: "sv2D", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "ミモザ",           setName: "sv1V", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "ミモザ",           setName: "sv1V", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "キハダ",           setName: "sv1a", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "キハダ",           setName: "sv1a", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "ボタン",           setName: "sv1S", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "ボタン",           setName: "sv1S", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "サーナイト ex",    setName: "sv1S", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "ゲッコウガ ex",    setName: "sv2a", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "リザードン ex",    setName: "sv2a", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "リザードン ex",    setName: "sv2a", rarity: "SAR", condition: "LP" },
  { game: "pokemon", name: "ピカチュウ",       setName: "sv1a", rarity: "AR",  condition: "NM" },
  // SWSH era
  { game: "pokemon", name: "カイ",             setName: "s10P", rarity: "SAR", condition: "NM" },
  { game: "pokemon", name: "カイ",             setName: "s10P", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "セレナ",           setName: "s11a", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "セレナ",           setName: "s11a", rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "マリィ",           setName: "s4a",  rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "マリィのプライド", setName: "sI",   rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "ユウリ",           setName: "s8b",  rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "リザードン VSTAR", setName: "s9",   rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "リザードン VMAX",  setName: "s4a",  rarity: "SSR", condition: "NM" },
  { game: "pokemon", name: "ブラッキー VMAX",  setName: "s6a",  rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "ブラッキー VMAX",  setName: "s6a",  rarity: "HR",  condition: "LP" },
  { game: "pokemon", name: "ニンフィア VMAX",  setName: "s6a",  rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "グレイシア VMAX",  setName: "s6a",  rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "リーフィア VMAX",  setName: "s6a",  rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "ミュウ VMAX",      setName: "s8",   rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "ピカチュウ",       setName: "s8b",  rarity: "CSR", condition: "NM" },
  { game: "pokemon", name: "ボスの指令",       setName: "s2",   rarity: "SR",  condition: "NM" },
  // Sun & Moon era
  { game: "pokemon", name: "リーリエ",         setName: "sm4+", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "アセロラ",         setName: "sm2+", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "ルチア",           setName: "sm7",  rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "シロナ",           setName: "sm5M", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "シロナ&カトレア",  setName: "sm12", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "かんこうきゃく",  setName: "sm12a", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "メイ",             setName: "sm11b", rarity: "SR", condition: "NM" },
  { game: "pokemon", name: "ヒガナ",           setName: "sm6a", rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "リザードン GX",    setName: "sm3H", rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "ブラッキー GX",    setName: "sm1M", rarity: "HR",  condition: "NM" },
  { game: "pokemon", name: "ミュウツー GX",    setName: "sm3+", rarity: "HR",  condition: "NM" },
  // BW era
  { game: "pokemon", name: "フウロ",           setName: "bw7",  rarity: "SR",  condition: "NM" },
  { game: "pokemon", name: "ベル",             setName: "bw6",  rarity: "SR",  condition: "NM" },
  // Promo
  { game: "pokemon", name: "ピカチュウ",       setName: "S-P",  rarity: "プロモ 001", condition: "NM" },
  { game: "pokemon", name: "ピカチュウ",       setName: "S-P",  rarity: "プロモ 323", condition: "NM" },
  // 旧裏
  { game: "pokemon", name: "リザードン",       setName: "旧裏 第1弾", rarity: "キラ", condition: "NM" },
  { game: "pokemon", name: "リザードン",       setName: "旧裏 第1弾", rarity: "キラ", condition: "LP" },
];

const ONEPIECE = [
  // OP-01
  { game: "onepiece", name: "Kaido",              setName: "OP-01 Romance Dawn",      rarity: "SEC",  condition: "NM" },
  { game: "onepiece", name: "Shanks",             setName: "OP-01 Romance Dawn",      rarity: "SEC",  condition: "NM" },
  { game: "onepiece", name: "Monkey D. Luffy",    setName: "OP-01 Romance Dawn",      rarity: "SR",   condition: "NM" },
  // OP-02
  { game: "onepiece", name: "Portgas D. Ace",     setName: "OP-02 Paramount War",     rarity: "SEC",  condition: "NM" },
  { game: "onepiece", name: "Yamato",             setName: "OP-02 Paramount War",     rarity: "SEC",  condition: "NM" },
  { game: "onepiece", name: "Sabo",               setName: "OP-02 Paramount War",     rarity: "SR",   condition: "NM" },
  // OP-03
  { game: "onepiece", name: "Charlotte Linlin",   setName: "OP-03 Pillars of Strength", rarity: "SEC", condition: "NM" },
  { game: "onepiece", name: "Trafalgar Law",      setName: "OP-03 Pillars of Strength", rarity: "SR",  condition: "NM" },
  // OP-04
  { game: "onepiece", name: "Monkey D. Luffy",    setName: "OP-04 Kingdoms of Intrigue", rarity: "SEC", condition: "NM" },
  // OP-05
  { game: "onepiece", name: "Vinsmoke Sanji",     setName: "OP-05 Awakening of the New Era", rarity: "SEC", condition: "NM" },
  // OP-06
  { game: "onepiece", name: "Shanks",             setName: "OP-06 Wings of the Captain",  rarity: "SEC", condition: "NM" },
  // OP-08
  { game: "onepiece", name: "Gol D. Roger",       setName: "OP-08 Two Legends",       rarity: "SEC", condition: "NM" },
  { game: "onepiece", name: "Whitebeard",         setName: "OP-08 Two Legends",       rarity: "SEC", condition: "NM" },
];

const ONEPIECE_COMIPARA = [
  { game: "onepiece", name: "モンキー・D・ルフィ",   setName: "OP-05", rarity: "コミパラ",        condition: "NM" },
  { game: "onepiece", name: "ポートガス・D・エース", setName: "OP-02", rarity: "コミパラ",        condition: "NM" },
  { game: "onepiece", name: "シャンクス",            setName: "OP-01", rarity: "コミパラ",        condition: "NM" },
  { game: "onepiece", name: "サボ",                  setName: "OP-04", rarity: "コミパラ",        condition: "NM" },
  { game: "onepiece", name: "トラファルガー・ロー",  setName: "OP-05", rarity: "コミパラ",        condition: "NM" },
  { game: "onepiece", name: "ナミ",                  setName: "OP-01", rarity: "パラレル",        condition: "NM" },
  { game: "onepiece", name: "ナミ",                  setName: "OP-02", rarity: "SR パラレル",     condition: "NM" },
  { game: "onepiece", name: "ロビン",                setName: "OP-03", rarity: "パラレル",        condition: "NM" },
  { game: "onepiece", name: "ハンコック",            setName: "OP-01", rarity: "パラレル",        condition: "NM" },
  { game: "onepiece", name: "ルフィ",                setName: "OP-01", rarity: "リーダーパラレル", condition: "NM" },
  { game: "onepiece", name: "ゾロ",                  setName: "OP-01", rarity: "リーダーパラレル", condition: "NM" },
  { game: "onepiece", name: "キッド",                setName: "OP-02", rarity: "リーダーパラレル", condition: "NM" },
  { game: "onepiece", name: "ロー",                  setName: "OP-02", rarity: "リーダーパラレル", condition: "NM" },
  { game: "onepiece", name: "カイドウ",              setName: "OP-01", rarity: "SR パラレル",     condition: "NM" },
  { game: "onepiece", name: "ビッグマム",            setName: "OP-03", rarity: "SR パラレル",     condition: "NM" },
  { game: "onepiece", name: "ヤマト",                setName: "OP-01", rarity: "SEC パラレル",    condition: "NM" },
  { game: "onepiece", name: "ウタ",                  setName: "OP-02", rarity: "SEC パラレル",    condition: "NM" },
];

const YUGIOH = [
  { game: "yugioh", name: "青眼の白龍",              setName: "初期 第1弾",  rarity: "ウルトラレア",           condition: "NM" },
  { game: "yugioh", name: "青眼の白龍",              setName: "初期 第1弾",  rarity: "ウルトラレア",           condition: "LP" },
  { game: "yugioh", name: "青眼の白龍",              setName: "レリーフ",    rarity: "レリーフレア",           condition: "NM" },
  { game: "yugioh", name: "ブラック・マジシャン",    setName: "初期 第1弾",  rarity: "ウルトラレア",           condition: "NM" },
  { game: "yugioh", name: "ブラック・マジシャン・ガール", setName: "20th", rarity: "20thシークレット",       condition: "NM" },
  { game: "yugioh", name: "真紅眼の黒竜",            setName: "レリーフ",    rarity: "レリーフレア",           condition: "NM" },
  { game: "yugioh", name: "万物創世龍",              setName: "QCCP",        rarity: "10000シークレット",      condition: "NM" },
  { game: "yugioh", name: "ブラック・ローズ・ドラゴン", setName: "レリーフ", rarity: "レリーフレア",           condition: "NM" },
  { game: "yugioh", name: "閃刀姫－レイ",            setName: "20th",        rarity: "20thシークレット",       condition: "NM" },
  { game: "yugioh", name: "灰流うらら",              setName: "プリズマ",    rarity: "プリズマティックシークレット", condition: "NM" },
  { game: "yugioh", name: "増殖するG",               setName: "20th",        rarity: "20thシークレット",       condition: "NM" },
];

const MTG = [
  { game: "mtg", name: "Black Lotus",     setName: "Alpha",     rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Black Lotus",     setName: "Beta",      rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Black Lotus",     setName: "Unlimited", rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Mox Jet",         setName: "Alpha",     rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Mox Jet",         setName: "Beta",      rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Underground Sea", setName: "Revised",   rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Underground Sea", setName: "Revised",   rarity: "Rare", condition: "LP" },
  { game: "mtg", name: "Volcanic Island", setName: "Revised",   rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Volcanic Island", setName: "Revised",   rarity: "Rare", condition: "LP" },
  { game: "mtg", name: "Time Walk",       setName: "Alpha",     rarity: "Rare", condition: "NM" },
  { game: "mtg", name: "Time Walk",       setName: "Beta",      rarity: "Rare", condition: "NM" },
];

const ALL_CARDS = [...POKEMON, ...POKEMON_JP, ...ONEPIECE, ...ONEPIECE_COMIPARA, ...YUGIOH, ...MTG];

// ── Slug generation ───────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .trim()
    .replace(/^-+|-+$/g, "");
}

function setCode(setName) {
  const leading = setName.match(/^([A-Za-z]{1,6}[-]?\d{1,3}[A-Za-z]?)\b/);
  if (leading) return slugify(leading[1]);
  return slugify(setName.split(/\s+/).slice(0, 2).join(" "));
}

function buildSlug(card) {
  return [slugify(card.name), setCode(card.setName), slugify(card.rarity), slugify(card.condition)]
    .filter(Boolean)
    .join("-");
}

function resolveSlug(base, used) {
  if (!used.has(base)) { used.add(base); return base; }
  let n = 1;
  while (used.has(`${base}-${n}`)) n++;
  const s = `${base}-${n}`;
  used.add(s);
  return s;
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const isDry   = args.includes("--dry");
const gameArg = args.find((a) => a.startsWith("--game="))?.slice(7);
const cards   = gameArg ? ALL_CARDS.filter((c) => c.game === gameArg) : ALL_CARDS;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("GCI Card Seed (standalone)");
  console.log(`  dry-run : ${isDry}`);
  console.log(`  game    : ${gameArg ?? "all"}`);
  console.log(`  cards   : ${cards.length}`);
  console.log();

  const existingSlugs = await prisma.card.findMany({
    select: { slug: true },
    where:  { slug: { not: null } },
  });
  const usedSlugs = new Set(existingSlugs.map((c) => c.slug));

  let created = 0, skipped = 0, errored = 0;

  for (const card of cards) {
    const baseSlug = buildSlug(card);
    if (!baseSlug) { skipped++; continue; }
    const slug = resolveSlug(baseSlug, usedSlugs);

    if (isDry) {
      console.log(`  [${card.game}] "${card.name}" ${card.setName} ${card.rarity}/${card.condition} → ${slug}`);
      created++;
      continue;
    }

    try {
      await prisma.card.upsert({
        where:  { name_setName_rarity_condition: { name: card.name, setName: card.setName, rarity: card.rarity, condition: card.condition } },
        update: { game: card.game },
        create: { name: card.name, setName: card.setName, rarity: card.rarity, condition: card.condition, game: card.game, slug },
      });
      created++;
    } catch (err) {
      console.error(`  ✗ "${card.name}" ${card.setName} — ${err.message}`);
      errored++;
    }

    if (created % 20 === 0 && created > 0) process.stdout.write(".");
  }

  if (!isDry && created >= 20) console.log();
  console.log();
  console.log(`  created/updated : ${created}${isDry ? " (dry — not written)" : ""}`);
  console.log(`  skipped         : ${skipped}`);
  console.log(`  errored         : ${errored}`);
  console.log();
  console.log(errored > 0 ? "✗ Completed with errors." : isDry ? "✓ Dry-run passed." : "✓ Done.");
}

main()
  .catch((err) => { console.error("Fatal:", err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
