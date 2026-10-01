/**
 * resolve-unverified-cards.ts — 「そのセットに実在が確認できないカード」の後始末
 *
 * 使い方（apps/data から実行）:
 *   node --env-file=.env.local --import tsx scripts/resolve-unverified-cards.ts                  # DRY-RUN
 *   BACKUP=<保存先.json> node --env-file=.env.local --import tsx scripts/resolve-unverified-cards.ts --apply
 *
 * 背景（2026-10-01）: カード番号の調査で、公式サイトでそのセットに実在が確認できないカードが
 * 見つかった。元の出品タイトルを確認した結果に基づき、次の3つを行う。
 *   1. s8b「ピカチュウ CSR」: ピカチュウV CSR（222/184）と ピカチュウVMAX CSR（223/184）の
 *      2種類が混ざっていた → タイトル（VMAX の表記・番号）で振り分けて2枚に分ける
 *   2. QCCP「万物創世龍」: 中身は IGAS-JP000 の 10000シークレットで、素の状態と PSA10 が
 *      混ざっていた → PSA10 は IGAS の PSA10 へ、素の状態は IGAS の NM へ統合。
 *      PSA9・ARS・アジア版などの別物は移さず、QCCP 側は非表示
 *   3. scripts/data/group4-hide.json のカード: まとめ売り・無関係なカードの価格だった、
 *      または元のタイトルが残っておらず確認できない → 非表示（削除はしない）
 */

import { prisma } from "@gci/db";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const APPLY = process.argv.includes("--apply");
type Log = { action: string; table?: string; id: string; from?: string; to?: string; note?: string };
const log: Log[] = [];

const norm = (s: string) => s.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

async function sources(prices: { id: string; fingerprint: string | null; cardId: string }[]) {
  const rarIds = prices.map((p) => p.fingerprint ?? "").filter((f) => f.startsWith("rar:")).map((f) => f.slice(4));
  const urls = prices.map((p) => p.fingerprint ?? "").filter((f) => f.startsWith("rml:")).map((f) => f.slice(4));
  const rars = await prisma.rawAuctionResult.findMany({ where: { id: { in: rarIds } }, select: { id: true, title: true } });
  const rmls = await prisma.rawMarketListing.findMany({ where: { url: { in: urls }, cardId: { in: [...new Set(prices.map((p) => p.cardId))] } }, select: { id: true, title: true, url: true } });
  return (p: { fingerprint: string | null }) => {
    const f = p.fingerprint ?? "";
    if (f.startsWith("rar:")) { const r = rars.find((x) => x.id === f.slice(4)); return r ? { title: r.title, rar: r.id, rml: null as string | null } : null; }
    if (f.startsWith("rml:")) { const r = rmls.find((x) => x.url === f.slice(4)); return r ? { title: r.title, rar: null as string | null, rml: r.id } : null; }
    return null;
  };
}

async function moveTo(priceIds: string[], rarIds: string[], rmlIds: string[], from: string, to: string) {
  if (priceIds.length) await prisma.price.updateMany({ where: { id: { in: priceIds } }, data: { cardId: to } });
  if (rarIds.length) await prisma.rawAuctionResult.updateMany({ where: { id: { in: rarIds } }, data: { cardId: to } });
  if (rmlIds.length) await prisma.rawMarketListing.updateMany({ where: { id: { in: rmlIds } }, data: { cardId: to } });
  for (const id of priceIds) log.push({ action: "move", table: "Price", id, from, to });
  for (const id of rarIds) log.push({ action: "move", table: "RawAuctionResult", id, from, to });
  for (const id of rmlIds) log.push({ action: "move", table: "RawMarketListing", id, from, to });
}

// ── 1. s8b ピカチュウ CSR を ピカチュウV / ピカチュウVMAX に分ける ─────────────
async function splitPikachuCsr() {
  const src = await prisma.card.findFirst({ where: { setName: "s8b", name: "ピカチュウ", rarity: "CSR", condition: "NM", deletedAt: null }, select: { id: true, game: true } });
  if (!src) { console.log("1. s8b ピカチュウ CSR: 対象なし（処理済み）"); return; }
  const prices = await prisma.price.findMany({ where: { cardId: src.id }, select: { id: true, price: true, fingerprint: true, cardId: true } });
  const srcOf = await sources(prices);
  const cls = (title: string | null): "V" | "VMAX" | "?" => {
    if (!title) return "?";
    const t = norm(title);
    if (/223\/184/.test(t) || /VMAX(?!クライマックス)/.test(t.replace(/VMAXクライマックス/g, ""))) return "VMAX";
    if (/222\/184/.test(t) || /ピカチュウV/.test(t)) return "V";
    return "?";
  };
  const titled = prices.map((p) => ({ p, c: cls(srcOf(p)?.title ?? null) }));
  const mV = median(titled.filter((x) => x.c === "V").map((x) => x.p.price));
  const mX = median(titled.filter((x) => x.c === "VMAX").map((x) => x.p.price));
  const th = mV && mX && mX >= mV * 2 ? Math.sqrt(mV * mX) : null;
  const decide = (c: "V" | "VMAX" | "?", price: number) => (c !== "?" ? c : th ? (price > th ? "VMAX" : "V") : "V");
  const toVmax = titled.filter((x) => decide(x.c, x.p.price) === "VMAX");
  console.log(`1. s8b ピカチュウ CSR: 価格${prices.length}件 → ピカチュウV ${prices.length - toVmax.length}件 / ピカチュウVMAX ${toVmax.length}件` +
    `（タイトル判定 V中央値¥${mV?.toLocaleString()} / VMAX中央値¥${mX?.toLocaleString()}${th ? `、判定できない分は境目¥${Math.round(th).toLocaleString()}で振り分け` : ""}）`);
  if (!APPLY) return;
  const vmax = await prisma.card.create({
    data: { name: "ピカチュウVMAX", setName: "s8b", rarity: "CSR", condition: "NM", game: src.game, slug: "ピカチュウvmax-s8b-csr-nm", cardNumber: "223/184" },
    select: { id: true },
  });
  log.push({ action: "create", id: vmax.id, note: "s8b ピカチュウVMAX CSR NM" });
  await moveTo(toVmax.map((x) => x.p.id),
    toVmax.map((x) => srcOf(x.p)?.rar).filter((v): v is string => !!v),
    toVmax.map((x) => srcOf(x.p)?.rml).filter((v): v is string => !!v), src.id, vmax.id);
  await prisma.card.update({ where: { id: src.id }, data: { name: "ピカチュウV", cardNumber: "222/184" } });
  log.push({ action: "rename", id: src.id, note: "s8b ピカチュウ CSR → ピカチュウV CSR" });
}

// ── 2. QCCP 万物創世龍 を IGAS-JP000 の NM / PSA10 に振り分けて統合 ───────────────
async function resolveTenThousand() {
  const src = await prisma.card.findFirst({ where: { setName: "QCCP", name: "万物創世龍", rarity: "10000シークレット", deletedAt: null, isVisible: true }, select: { id: true } });
  if (!src) { console.log("2. QCCP 万物創世龍: 対象なし（処理済み）"); return; }
  const nm = await prisma.card.findFirst({ where: { setName: "IGAS-JP000 IGNITION ASSAULT", name: "万物創世龍", rarity: "10000シークレット", condition: "NM", deletedAt: null }, select: { id: true } });
  const psa = await prisma.card.findFirst({ where: { setName: "IGAS-JP000 IGNITION ASSAULT", name: "万物創世龍", rarity: "10000シークレット", condition: "PSA10", deletedAt: null }, select: { id: true } });
  if (!nm || !psa) { console.log("2. QCCP 万物創世龍: 統合先が見つからないためスキップ"); return; }
  const prices = await prisma.price.findMany({ where: { cardId: src.id }, select: { id: true, price: true, fingerprint: true, cardId: true } });
  const srcOf = await sources(prices);
  const groups = { PSA10: [] as typeof prices, NM: [] as typeof prices, 残す: [] as typeof prices };
  for (const p of prices) {
    const t = srcOf(p)?.title;
    if (!t) { groups.残す.push(p); continue; }
    const n = norm(t);
    if (/PSA10/.test(n)) groups.PSA10.push(p);
    else if (/PSA\d|ARS|BGS|CGC|アジア|英語|ASIA/.test(n)) groups.残す.push(p);
    else groups.NM.push(p);
  }
  console.log(`2. QCCP 万物創世龍: 価格${prices.length}件 → IGAS の PSA10 へ ${groups.PSA10.length}件 / NM へ ${groups.NM.length}件 / 別物・タイトル不明で移さない ${groups.残す.length}件（QCCP 側は非表示）`);
  if (!APPLY) return;
  for (const [g, to] of [["PSA10", psa.id], ["NM", nm.id]] as const) {
    const ps = groups[g];
    await moveTo(ps.map((p) => p.id),
      ps.map((p) => srcOf(p)?.rar).filter((v): v is string => !!v),
      ps.map((p) => srcOf(p)?.rml).filter((v): v is string => !!v), src.id, to);
  }
  await prisma.card.update({ where: { id: src.id }, data: { isVisible: false, mergedIntoCardId: nm.id } });
  log.push({ action: "hide", id: src.id, to: nm.id });
}

// ── 3. 実在が確認できないカードを非表示 ─────────────────────────────────
async function hideUnverified() {
  const list = JSON.parse(readFileSync(join(__dirname, "data", "group4-hide.json"), "utf8")) as { setName: string; name: string; rarity: string }[];
  let n = 0;
  for (const k of list) {
    const cs = await prisma.card.findMany({ where: { ...k, deletedAt: null, isVisible: true }, select: { id: true } });
    n += cs.length;
    if (!APPLY) continue;
    for (const c of cs) {
      await prisma.card.update({ where: { id: c.id }, data: { isVisible: false } });
      log.push({ action: "hide", id: c.id, note: `${k.setName} / ${k.name} / ${k.rarity}` });
    }
  }
  console.log(`3. 非表示: ${list.length}種類（${n}行）`);
}

async function main() {
  console.log(`mode: ${APPLY ? "APPLY（本番更新）" : "DRY-RUN（書き込みなし）"}\n`);
  await splitPikachuCsr();
  await resolveTenThousand();
  await hideUnverified();
  if (APPLY) {
    const path = process.env.BACKUP ?? `resolve-unverified-backup-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
    console.log(`\nバックアップ: ${path}（記録 ${log.length}行）`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
