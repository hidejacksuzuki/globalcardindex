/**
 * scripts/restore-false-positives.ts
 *
 * cleanup-auction-mismatches の誤検出（記号差で正当カードを混入判定した分）を復元する。
 * 修正後 nameMatchesTitle で「名前一致する closed 行」が存在するカードのみ対象とし:
 *   1. 名前一致行を approved に戻す（混入行=名前不一致は rejected のまま）
 *   2. その行の Price を url+price 重複排除（srv:yah: fingerprint）で再作成
 *   3. per-card 指数を再計算
 *
 * ムンク系（"ムンクミミッキュ" 等、DB名が連結でタイトルが "ムンク展 ミミッキュ"）は
 * トークン照合で一致0のため本スクリプトの対象外。手動で扱う。
 *
 * 入力: 直近クリーンアップで処理した cardId 一覧ファイル（1行1id）。
 * デフォルト DRY-RUN。書き込みは --apply。
 *
 * 実行（apps/data から）:
 *   cd apps/data
 *   node --env-file=.env.local --import tsx scripts/restore-false-positives.ts --ids=/path/to/cleaned_cardids.txt
 *   ... --apply
 */

import { readFileSync }       from "node:fs";
import { prisma }             from "@gci/db";
import { nameMatchesTitle, recalcCardIndex } from "@gci/core";

const args    = process.argv.slice(2);
const APPLY   = args.includes("--apply");
const IDS_ARG = args.find((a) => a.startsWith("--ids="))?.slice(6);

async function main() {
  if (!IDS_ARG) { console.error("--ids=<file> が必要です"); process.exit(1); }
  const ids = readFileSync(IDS_ARG, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  console.log(`モード: ${APPLY ? "★APPLY（本番書き込み）" : "DRY-RUN"} / 候補 ${ids.length} カード`);

  let restoredRows = 0, pricesCreated = 0, recalced = 0, targetCards = 0;

  for (const id of ids) {
    const card = await prisma.card.findUnique({
      where: { id }, select: { id: true, name: true, setName: true, rarity: true },
    });
    if (!card) continue;

    const rows = await prisma.rawAuctionResult.findMany({
      where: { cardId: id, source: "yahoo_auction_closed" },
      select: { id: true, title: true, url: true, price: true, endedAt: true, capturedAt: true, status: true },
    });
    const matching = rows.filter((r) => nameMatchesTitle(r.title, card.name));
    if (matching.length === 0) continue;   // 真の混入カード（ムンク系含む）はスキップ

    targetCards++;
    // cleanup が壊したのは「approved→rejected にされた行」。今 rejected の名前一致行のみ復帰。
    const rejectedMatching = matching.filter((r) => r.status === "rejected");
    // Price は「復帰後に approved になる行」= pending 以外の名前一致行のみ対象
    // （pending 行に Price を作ると元々無かったデータを増やすため除外）。
    const priceRows = matching.filter((r) => r.status !== "pending");
    const priceMap = new Map<string, typeof matching[number]>();
    for (const r of priceRows) {
      const fp = `srv:yah:${r.url ?? r.id}:${r.price}`;
      if (!priceMap.has(fp)) priceMap.set(fp, r);
    }

    console.log(`  ${card.name} / ${card.setName} / ${card.rarity}  一致${matching.length}行(要復帰${rejectedMatching.length}) / 一意Price ${priceMap.size}`);

    if (!APPLY) continue;
    if (rejectedMatching.length === 0 && priceMap.size === 0) continue;

    // 1. rejected の名前一致行のみ approved に戻す
    if (rejectedMatching.length > 0) {
      const upd = await prisma.rawAuctionResult.updateMany({
        where: { id: { in: rejectedMatching.map((r) => r.id) } },
        data:  { status: "approved" },
      });
      restoredRows += upd.count;
    }

    // 2. Price を再作成（url+price 重複排除、既存は skipDuplicates）
    if (priceMap.size > 0) {
      const created = await prisma.price.createMany({
        data: [...priceMap.entries()].map(([fp, r]) => ({
          cardId:      card.id,
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

    // 3. 再計算
    await recalcCardIndex(card.id, "manual").catch(() => null);
    recalced++;
  }

  console.log(`\n対象(一致あり)カード: ${targetCards}`);
  if (APPLY) {
    console.log(`★完了: approved復帰=${restoredRows} 行 / Price作成=${pricesCreated} / recalc=${recalced}`);
  } else {
    console.log(`DRY-RUN のため書き込みなし。--apply で実行。`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
