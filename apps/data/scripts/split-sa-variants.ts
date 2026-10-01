/**
 * split-sa-variants.ts — 1つの登録に混ざっていた「通常版 HR」と「SA 絵柄の HR」を2枚に分ける
 *
 * 使い方（apps/data から実行）:
 *   node --env-file=.env.local --import tsx scripts/split-sa-variants.ts                  # DRY-RUN
 *   BACKUP=<保存先.json> node --env-file=.env.local --import tsx scripts/split-sa-variants.ts --apply
 *
 * 背景（2026-10-01）: イーブイヒーローズの VMAX HR などは、同じ「HR」表記で通常版と SA 絵柄版の
 * 2種類があり、1つの登録に両方の価格が混ざっていた（例: ブラッキーVMAX 通常 ¥6,800 / SA ¥480,000）。
 *
 * 振り分け方:
 *   1. 元の出品タイトルにカード番号があれば番号で、無ければ「SA」等の表記で判定
 *   2. タイトルで判定できない・タイトルが残っていない価格は、タイトルで判定できた
 *      通常版と SA 版の中央値の幾何平均を境目にして、価格で判定（両者は10倍以上離れている）
 *   3. SA 版の価格と元の出品データを、新しく作る（または既存の）SA 版カードに移す
 *
 * 元のカードは通常版 HR として残し、カード番号を設定する。--apply 時は移動した行を
 * BACKUP に記録する（cardId を元に戻せば復元できる）。
 */

import { prisma } from "@gci/db";
import { writeFileSync } from "fs";

type Group = { label: string; setNames: string[]; names: string[]; aNum: string; bNum: string };
const GROUPS: Group[] = [
  { label: "ブラッキーVMAX", setNames: ["s6a", "s6a イーブイヒーローズ"], names: ["ブラッキー VMAX", "ブラッキーVMAX"], aNum: "094/069", bNum: "095/069" },
  { label: "グレイシアVMAX", setNames: ["s6a", "s6a イーブイヒーローズ"], names: ["グレイシア VMAX", "グレイシアVMAX"], aNum: "090/069", bNum: "091/069" },
  { label: "ニンフィアVMAX", setNames: ["s6a", "s6a イーブイヒーローズ"], names: ["ニンフィア VMAX", "ニンフィアVMAX"], aNum: "092/069", bNum: "093/069" },
  { label: "リーフィアVMAX", setNames: ["s6a", "s6a イーブイヒーローズ"], names: ["リーフィア VMAX", "リーフィアVMAX"], aNum: "088/069", bNum: "089/069" },
  { label: "レックウザVMAX", setNames: ["s7R 蒼空ストリーム"], names: ["レックウザVMAX"], aNum: "082/067", bNum: "083/067" },
  { label: "ミュウVMAX", setNames: ["s8", "s8 フュージョンアーツ"], names: ["ミュウ VMAX", "ミュウVMAX"], aNum: "118/100", bNum: "119/100" },
];
const A_RARITY = "HR";
const B_RARITY = "SA";
const B_KEYWORD = /(?<![A-Za-z])SA(?![A-Za-z])|スペシャルアート/i;

const APPLY = process.argv.includes("--apply");

const norm = (s: string) => s.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
function hasNum(title: string, num: string): boolean {
  const [a, b] = num.split("/");
  return new RegExp(`(?<!\\d)0*${+a}/0*${+b}(?!\\d)`).test(norm(title));
}
function classifyTitle(title: string, g: Group): "A" | "B" | "?" {
  const a = hasNum(title, g.aNum), b = hasNum(title, g.bNum);
  if (a && !b) return "A";
  if (b && !a) return "B";
  if (B_KEYWORD.test(title)) return "B";
  return "?";
}
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
/** 既存カードと同じ日本語保持スラッグ規則（add-cards.ts と同じ） */
const jaSlugify = (str: string) => str.toLowerCase().replace(/[・/]/g, "").trim().replace(/\s+/g, "-");
async function uniqueSlug(base: string): Promise<string> {
  if (!(await prisma.card.findUnique({ where: { slug: base }, select: { id: true } }))) return base;
  for (let n = 2; ; n++) {
    const s = `${base}-${n}`;
    if (!(await prisma.card.findUnique({ where: { slug: s }, select: { id: true } }))) return s;
  }
}

type Move = { table: "Price" | "RawAuctionResult" | "RawMarketListing"; id: string; from: string; to: string };

async function main() {
  console.log(`mode: ${APPLY ? "APPLY（本番更新）" : "DRY-RUN（書き込みなし）"}\n`);
  const moves: Move[] = [];
  const created: string[] = [];
  const numbered: { id: string; cardNumber: string }[] = [];

  for (const g of GROUPS) {
    const xs = await prisma.card.findMany({
      where:  { setName: { in: g.setNames }, name: { in: g.names }, rarity: A_RARITY, deletedAt: null },
      select: { id: true, name: true, setName: true, condition: true, game: true },
    });
    const xIds = xs.map((x) => x.id);

    // 価格と、その価格の元になった出品（fingerprint でつながっているものだけ）
    const prices = await prisma.price.findMany({ where: { cardId: { in: xIds } }, select: { id: true, cardId: true, price: true, fingerprint: true } });
    const rarIds = prices.map((p) => p.fingerprint).filter((f): f is string => !!f && f.startsWith("rar:")).map((f) => f.slice(4));
    const rmlUrls = prices.map((p) => p.fingerprint).filter((f): f is string => !!f && f.startsWith("rml:")).map((f) => f.slice(4));
    const rars = await prisma.rawAuctionResult.findMany({ where: { id: { in: rarIds } }, select: { id: true, cardId: true, title: true } });
    const rmls = await prisma.rawMarketListing.findMany({ where: { cardId: { in: xIds }, url: { in: rmlUrls } }, select: { id: true, cardId: true, title: true, url: true } });
    const rarById = new Map(rars.map((r) => [r.id, r]));
    const condOf = new Map(xs.map((x) => [x.id, x.condition]));
    const source = (p: { cardId: string; fingerprint: string | null }) => {
      if (p.fingerprint?.startsWith("rar:")) {
        const r = rarById.get(p.fingerprint.slice(4));
        return r ? { title: r.title, rar: r.id, rml: null as string | null } : null;
      }
      if (p.fingerprint?.startsWith("rml:")) {
        const url = p.fingerprint.slice(4);
        const r = rmls.find((m) => m.url === url && m.cardId === p.cardId);
        return r ? { title: r.title, rar: null as string | null, rml: r.id } : null;
      }
      return null;
    };

    // 境目の金額: 状態（NM / PSA10 など）ごとに、タイトルで判定できた価格の中央値の幾何平均
    const titledByCond = new Map<string, { A: number[]; B: number[] }>();
    for (const p of prices) {
      const src = source(p);
      if (!src) continue;
      const c = classifyTitle(src.title, g);
      if (c === "?") continue;
      const cond = condOf.get(p.cardId)!;
      const t = titledByCond.get(cond) ?? { A: [], B: [] };
      t[c].push(p.price);
      titledByCond.set(cond, t);
    }
    console.log(`■ ${g.label}`);

    // 境目の決め方（上から順に、計算できたものを使う）
    //   1. その状態で、通常版・SA 版ともタイトル判定が3件以上 → 両者の中央値の幾何平均
    //   2. 片方しか無い → 境目を計算できた別の状態（基準）を、手元にある側の中央値の比で換算
    //   3. どの状態でも計算できない → 全状態のタイトル判定をまとめて幾何平均
    const full = (t: { A: number[]; B: number[] }) => {
      const a = median(t.A), b = median(t.B);
      return a && b && t.A.length >= 3 && t.B.length >= 3 && b >= a * 3 ? { a, b, th: Math.sqrt(a * b) } : null;
    };
    const ref = [...titledByCond.values()].map(full).find((v) => v !== null) ?? null;
    const pooledT = { A: [...titledByCond.values()].flatMap((t) => t.A), B: [...titledByCond.values()].flatMap((t) => t.B) };
    const pooled = full(pooledT);
    const thresholdFor = (cond: string): { th: number; how: string } | null => {
      const t = titledByCond.get(cond) ?? { A: [], B: [] };
      const f1 = full(t);
      if (f1) return { th: f1.th, how: `通常¥${f1.a.toLocaleString()}/SA¥${f1.b.toLocaleString()}` };
      const a = median(t.A), b = median(t.B);
      if (ref && t.B.length >= 3 && b) return { th: b * (ref.th / ref.b), how: `SA側¥${b.toLocaleString()}から換算` };
      if (ref && t.A.length >= 3 && a) return { th: a * (ref.th / ref.a), how: `通常側¥${a.toLocaleString()}から換算` };
      if (pooled) return { th: pooled.th, how: `全状態まとめ 通常¥${pooled.a.toLocaleString()}/SA¥${pooled.b.toLocaleString()}` };
      return null;
    };

    for (const x of xs) {
      const tf = thresholdFor(x.condition);
      const threshold = tf?.th ?? null;
      const decide = (title: string | null, price: number): "A" | "B" | "?" => {
        const c = title ? classifyTitle(title, g) : "?";
        if (c !== "?") return c;
        if (threshold === null) return "?";
        return price > threshold ? "B" : "A";
      };

      const myPrices = prices.filter((p) => p.cardId === x.id);
      const toB = myPrices.map((p) => ({ p, src: source(p) })).filter(({ p, src }) => decide(src?.title ?? null, p.price) === "B");
      const unknown = myPrices.filter((p) => decide(source(p)?.title ?? null, p.price) === "?");

      console.log(`  ${x.setName} / ${x.name} / ${x.condition}: ` +
        (tf ? `境目 ¥${Math.round(tf.th).toLocaleString()}（${tf.how}）` : `境目なし`) +
        ` → 価格 ${myPrices.length}件中 SA版へ ${toB.length}件・通常版に残す ${myPrices.length - toB.length - unknown.length}件` +
        (unknown.length ? `・判定できず通常版に残す ${unknown.length}件` : ""));

      if (!APPLY) continue;

      // SA 版カード（同じセット・名前・状態）を探す、無ければ作る
      let y = await prisma.card.findFirst({
        where:  { setName: x.setName, name: x.name, rarity: B_RARITY, condition: x.condition, deletedAt: null },
        select: { id: true },
      });
      if (!y) {
        const slug = await uniqueSlug([x.name, x.setName, B_RARITY, x.condition].map(jaSlugify).filter(Boolean).join("-"));
        y = await prisma.card.create({
          data: { name: x.name, setName: x.setName, rarity: B_RARITY, condition: x.condition, game: x.game, slug, cardNumber: g.bNum },
          select: { id: true },
        });
        created.push(y.id);
      } else {
        await prisma.card.update({ where: { id: y.id }, data: { cardNumber: g.bNum } });
      }
      await prisma.card.update({ where: { id: x.id }, data: { cardNumber: g.aNum } });
      numbered.push({ id: x.id, cardNumber: g.aNum });

      const priceIds = toB.map(({ p }) => p.id);
      const rarMove = toB.map(({ src }) => src?.rar).filter((v): v is string => !!v);
      const rmlMove = toB.map(({ src }) => src?.rml).filter((v): v is string => !!v);
      if (priceIds.length) await prisma.price.updateMany({ where: { id: { in: priceIds } }, data: { cardId: y.id } });
      if (rarMove.length) await prisma.rawAuctionResult.updateMany({ where: { id: { in: rarMove } }, data: { cardId: y.id } });
      if (rmlMove.length) await prisma.rawMarketListing.updateMany({ where: { id: { in: rmlMove } }, data: { cardId: y.id } });
      for (const id of priceIds) moves.push({ table: "Price", id, from: x.id, to: y.id });
      for (const id of rarMove) moves.push({ table: "RawAuctionResult", id, from: x.id, to: y.id });
      for (const id of rmlMove) moves.push({ table: "RawMarketListing", id, from: x.id, to: y.id });
    }
    console.log("");
  }

  if (APPLY) {
    const path = process.env.BACKUP ?? `split-sa-backup-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), created, numbered, moves }, null, 1));
    console.log(`バックアップ: ${path}（移動 ${moves.length}行・新規カード ${created.length}枚）`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
