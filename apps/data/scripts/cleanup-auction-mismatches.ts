/**
 * scripts/cleanup-auction-mismatches.ts
 *
 * 「全件混入カード」の手当て（2026-07 マッチング精度改善 タスク c）。
 *
 * 承認済みヤフオク落札を nameMatchesTitle で判定し、
 * 「カード名（識別トークン）がタイトルに含まれる承認落札が【1件も無い】」
 * = そのカードに紐づく承認落札が全件別カード混入、というカードだけを対象に:
 *   1. 該当カードの approved closed 落札行を全て rejected へ
 *   2. そのカードの yahoo_auction_closed 由来 Price を削除
 *      （全件混入カードなので auction 由来 Price は全て誤り。fingerprint 種別に依存せず安全）
 *   3. 該当カードの per-card 指数を再計算（データ不足化したら汚染 IndexValue も削除）
 *
 * 判定は名前一致のみ（グレーディング減点等に依存しない）ため、
 * 「正しいカードだが raw↔graded で減点され承認閾値未満」の行を持つカードは
 * pass>0 となり対象から外れる（＝安全側。混在カードは (b) の全体再採点で扱う）。
 *
 * デフォルトは DRY-RUN（書き込みなし）。実書き込みは --apply を明示。
 *
 * 実行（apps/data から。@gci/core・@gci/db の解決のためこの位置に置く）:
 *   cd apps/data
 *   node --env-file=.env.local --import tsx scripts/cleanup-auction-mismatches.ts
 *   node --env-file=.env.local --import tsx scripts/cleanup-auction-mismatches.ts --apply
 *   ... --limit=50        # 対象カード数の上限（既定: 全件）
 */

import { prisma }                          from "@gci/db";
import { nameMatchesTitle, recalcCardIndex } from "@gci/core";

const APPROVED_STATUSES = ["approved", "auto_approved"];

const args    = process.argv.slice(2);
const APPLY   = args.includes("--apply");
const JP_ONLY = args.includes("--jp-only");   // 英語名カード（名前照合不能=誤検出リスク）を除外
const LIMIT   = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? "0") || undefined;

type CardMeta = { id: string; name: string; rarity: string; setName: string; condition: string };

async function main() {
  console.log(`モード: ${APPLY ? "★APPLY（本番書き込み）" : "DRY-RUN（書き込みなし）"}`);

  // カード メタを一括ロード（小テーブル）して Map に。巨大 join を避ける。
  const cardList = await prisma.card.findMany({
    select: { id: true, name: true, rarity: true, setName: true, condition: true },
  });
  const cardMeta = new Map<string, CardMeta>(cardList.map((c) => [c.id, c]));

  // 承認済みヤフオク落札を id カーソルでページングして取得（statement timeout 回避）。
  const perCard = new Map<string, { card: CardMeta; pass: number; fail: number; samples: string[] }>();
  const PAGE = 5000;
  let cursor: string | undefined;
  let scanned = 0;
  for (;;) {
    const batch = await prisma.rawAuctionResult.findMany({
      where: { source: "yahoo_auction_closed", status: { in: APPROVED_STATUSES } },
      select: { id: true, title: true, bidCount: true, cardId: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    for (const r of batch) {
      const c = cardMeta.get(r.cardId);
      if (!c) continue;
      let entry = perCard.get(c.id);
      if (!entry) { entry = { card: c, pass: 0, fail: 0, samples: [] }; perCard.set(c.id, entry); }

      // 名前のみで判定（グレーディング減点等に依存しない）。
      // pass = カード名がタイトルに存在する行 / fail = 存在しない行。
      if (nameMatchesTitle(r.title, c.name)) entry.pass++;
      else {
        entry.fail++;
        if (entry.samples.length < 3) entry.samples.push(r.title);
      }
    }

    scanned += batch.length;
    cursor = batch[batch.length - 1].id;
    if (batch.length < PAGE) break;
  }
  console.log(`スキャン: ${scanned} 承認落札 / ${perCard.size} カード`);

  // 「全件混入」= カード名がタイトルに含まれる承認行が 0（pass==0）。
  // 対象カードは approved closed 行を全て reject するため、行 id 列挙は不要。
  const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);
  const targets: { card: CardMeta; count: number; samples: string[]; asciiName: boolean }[] = [];
  for (const { card, pass, fail, samples } of perCard.values()) {
    if (pass === 0 && fail > 0) {
      targets.push({ card, count: fail, samples, asciiName: isAscii(card.name) });
    }
  }

  targets.sort((a, b) => b.count - a.count);

  // 英語名カードは Card.name が JP タイトルに構造的に一致できないため、
  // 「全件 name 未一致」でも真の別カード混入とは限らない（正当な出品も落ちる）。
  // --jp-only で除外して安全側に倒す。
  const asciiCount = targets.filter((t) => t.asciiName).length;
  const filtered = JP_ONLY ? targets.filter((t) => !t.asciiName) : targets;
  const scoped   = LIMIT ? filtered.slice(0, LIMIT) : filtered;

  let totalRows = 0;
  console.log(`\n全件混入候補カード: ${targets.length} 件（うち英語名 ${asciiCount} 件=誤検出リスク）`);
  console.log(`処理対象: ${scoped.length} 件${JP_ONLY ? "（--jp-only: 日本語名のみ）" : ""}${LIMIT ? `（--limit=${LIMIT}）` : ""}\n`);
  for (const { card, count, samples, asciiName } of scoped) {
    totalRows += count;
    console.log(`  ${String(count).padStart(4)} 落札  ${asciiName ? "[EN]" : "[JP]"} ${card.name} / ${card.setName} / ${card.rarity}  (cardId=${card.id})`);
    for (const s of samples) console.log(`         例: ${s}`);
  }
  console.log(`\n合計 reject 予定行: ${totalRows}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN のため書き込みなし。実行するには --apply を付けてください。`);
    return;
  }

  // ── 本番書き込み ──
  let rejected = 0, pricesDeleted = 0, recalced = 0, staleIdxDeleted = 0;
  for (const { card } of scoped) {
    // 1. 該当カードの approved closed 落札を全て rejected へ（全件混入のため全行対象）
    const rej = await prisma.rawAuctionResult.updateMany({
      where: { cardId: card.id, source: "yahoo_auction_closed", status: { in: APPROVED_STATUSES } },
      data:  { status: "rejected" },
    });
    rejected += rej.count;

    // 2. 全件混入カードなので yahoo_auction_closed 由来 Price を全削除
    const del = await prisma.price.deleteMany({
      where: { cardId: card.id, sourceType: "yahoo_auction_closed" },
    });
    pricesDeleted += del.count;

    // 3. per-card 指数の再計算
    const entry = await recalcCardIndex(card.id, "manual").catch(() => null);

    // 4. 再計算でデータ不足になった場合、汚染された古い IndexValue が残り
    //    表示され続けるため、当該カードの IndexValue を削除して no-data 表示に落とす。
    //    （legit な非オークション価格が残っていれば recalc が新値を書くのでここは通らない）
    if (!entry || entry.status === "no_data") {
      const delIdx = await prisma.indexValue.deleteMany({ where: { cardId: card.id } });
      staleIdxDeleted += delIdx.count;
    } else {
      recalced++;
    }
  }

  console.log(`\n★完了: rejected=${rejected} 行 / Price削除=${pricesDeleted} / recalc更新=${recalced} / 古いIndexValue削除=${staleIdxDeleted}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
