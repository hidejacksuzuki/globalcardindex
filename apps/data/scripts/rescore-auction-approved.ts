/**
 * scripts/rescore-auction-approved.ts
 *
 * 全体再採点バッチ（2026-07 マッチング精度改善 タスク b）。
 *
 * 承認済み（approved / auto_approved）ヤフオク落札の全行を auctionIdentityHit
 * （カード名トークン照合 or setName 由来のカード番号一致）で再判定し、
 * 本人確認できない行を rejected に落とす。カード単位で:
 *   1. 名前不一致の approved 行 → rejected
 *   2. 変更があったカードは yahoo_auction_closed 由来 Price を全削除し、
 *      残存 approved 行から url+price 重複排除（srv:yah: fingerprint）で再構築（冪等）
 *   3. per-card 指数を再計算。データ不足化したら古い IndexValue を削除
 *
 * 英語名カードの扱い（2026-08 CardAlias 対応）:
 *   - CardAlias(locale:"ja") を持つカードは、エイリアス（日本語名）も含めて
 *     auctionIdentityHit で判定する（例 "Sylveon ex" は "ニンフィアex" で照合）
 *   - ja エイリアスを持たない英語名カードは従来どおりスキップ
 *     （MTG 等はヤフオクでも英語名表記が通例で name 照合が機能しているため、
 *       エイリアス登録が済むまで誤 reject リスクを避けて保留）
 *
 * cleanup-auction-mismatches（全件混入カード専用）の一般化版。
 * 部分汚染カード（正当行と混入行が混在）も正しく処理できる。
 *
 * デフォルト DRY-RUN。実書き込みは --apply。
 *
 * 実行（apps/data から）:
 *   cd apps/data
 *   node --env-file=.env.local --import tsx scripts/rescore-auction-approved.ts
 *   node --env-file=.env.local --import tsx scripts/rescore-auction-approved.ts --apply
 *   ... --limit=50   # 処理カード数上限
 */

import { prisma } from "@gci/db";
import { auctionIdentityHit, recalcCardIndex } from "@gci/core";

const APPROVED_STATUSES = ["approved", "auto_approved"];

const args  = process.argv.slice(2);
const APPLY = args.includes("--apply");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0") || undefined;

const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);

type CardMeta = { id: string; name: string; setName: string; rarity: string; jaAliases: string[] };

async function main() {
  console.log(`モード: ${APPLY ? "★APPLY（本番書き込み）" : "DRY-RUN（書き込みなし）"}`);

  const cardList = await prisma.card.findMany({
    select: {
      id: true, name: true, setName: true, rarity: true,
      aliases: { where: { locale: "ja" }, select: { name: true } },
    },
  });
  const cardMeta = new Map<string, CardMeta>(
    cardList.map((c) => [c.id, { ...c, jaAliases: c.aliases.map((a) => a.name) }]),
  );

  // id カーソルでページングし、カード別に不一致行を集計（statement timeout 回避）
  const PAGE = 5000;
  let cursor: string | undefined;
  let scanned = 0;
  const perCard = new Map<string, { card: CardMeta; badIds: string[]; goodCount: number; samples: string[] }>();
  const skippedEn = new Map<string, number>(); // 英語名カード: cardId → 行数

  for (;;) {
    const batch = await prisma.rawAuctionResult.findMany({
      where: { source: "yahoo_auction_closed", status: { in: APPROVED_STATUSES } },
      select: { id: true, title: true, cardId: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    for (const r of batch) {
      const c = cardMeta.get(r.cardId);
      if (!c) continue;
      // 英語名かつ ja エイリアス未登録のカードは判定不能のためスキップ
      if (isAscii(c.name) && c.jaAliases.length === 0) {
        skippedEn.set(c.id, (skippedEn.get(c.id) ?? 0) + 1);
        continue;
      }
      let e = perCard.get(c.id);
      if (!e) { e = { card: c, badIds: [], goodCount: 0, samples: [] }; perCard.set(c.id, e); }
      if (auctionIdentityHit(r.title, c.name, c.setName, c.jaAliases)) e.goodCount++;
      else {
        e.badIds.push(r.id);
        if (e.samples.length < 2) e.samples.push(r.title);
      }
    }

    scanned += batch.length;
    cursor = batch[batch.length - 1].id;
    if (batch.length < PAGE) break;
  }

  const targets = [...perCard.values()].filter((e) => e.badIds.length > 0)
    .sort((a, b) => b.badIds.length - a.badIds.length);
  const scoped = LIMIT ? targets.slice(0, LIMIT) : targets;

  const totalBad = scoped.reduce((s, e) => s + e.badIds.length, 0);
  const enRows = [...skippedEn.values()].reduce((s, n) => s + n, 0);
  console.log(`スキャン: ${scanned} 行 / 判定対象 ${perCard.size} カード`);
  console.log(`英語名スキップ: ${skippedEn.size} カード ${enRows} 行（CardAlias 対応まで保留）`);
  console.log(`\n不一致行を持つカード: ${targets.length} 件${LIMIT ? `（今回処理 ${scoped.length}）` : ""} / reject 予定 ${totalBad} 行\n`);
  for (const e of scoped.slice(0, 30)) {
    console.log(`  bad${String(e.badIds.length).padStart(5)} good${String(e.goodCount).padStart(5)}  ${e.card.name} / ${e.card.setName} / ${e.card.rarity}`);
    for (const s of e.samples) console.log(`         例: ${s.slice(0, 60)}`);
  }
  if (scoped.length > 30) console.log(`  ...他 ${scoped.length - 30} カード`);

  if (!APPLY) {
    console.log(`\nDRY-RUN のため書き込みなし。--apply で実行。`);
    return;
  }

  // ── 本番書き込み（カード単位で reject → Price 再構築 → recalc）──
  let rejected = 0, pricesDeleted = 0, pricesCreated = 0, recalced = 0, idxDeleted = 0;
  for (const e of scoped) {
    const cardId = e.card.id;

    // 1. 不一致行を rejected へ（バッチ分割で timeout 回避）
    for (let i = 0; i < e.badIds.length; i += 2000) {
      const chunk = e.badIds.slice(i, i + 2000);
      const upd = await prisma.rawAuctionResult.updateMany({
        where: { id: { in: chunk } },
        data:  { status: "rejected" },
      });
      rejected += upd.count;
    }

    // 2. auction Price を全削除 → 残存 approved から再構築（冪等）
    const del = await prisma.price.deleteMany({
      where: { cardId, sourceType: "yahoo_auction_closed" },
    });
    pricesDeleted += del.count;

    const remaining = await prisma.rawAuctionResult.findMany({
      where: { cardId, source: "yahoo_auction_closed", status: { in: APPROVED_STATUSES } },
      select: { id: true, url: true, price: true, endedAt: true, capturedAt: true },
    });
    const pm = new Map<string, (typeof remaining)[number]>();
    for (const r of remaining) {
      const fp = `srv:yah:${r.url ?? r.id}:${r.price}`;
      if (!pm.has(fp)) pm.set(fp, r);
    }
    if (pm.size > 0) {
      const created = await prisma.price.createMany({
        data: [...pm.entries()].map(([fp, r]) => ({
          cardId,
          price:       r.price,
          observedAt:  r.endedAt ?? r.capturedAt,
          sourceType:  "yahoo_auction_closed",
          sourceName:  "yahoo_auction",
          fingerprint: fp,
        })),
        skipDuplicates: true,
      });
      pricesCreated += created.count;
    }

    // 3. recalc。データ不足なら汚染された古い IndexValue を削除
    const entry = await recalcCardIndex(cardId, "manual").catch(() => null);
    if (!entry || entry.status === "no_data") {
      const delIdx = await prisma.indexValue.deleteMany({ where: { cardId } });
      idxDeleted += delIdx.count;
    } else {
      recalced++;
    }
  }

  console.log(`\n★完了: rejected=${rejected} / Price削除=${pricesDeleted} 再作成=${pricesCreated} / recalc更新=${recalced} / 古いIndexValue削除=${idxDeleted}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
