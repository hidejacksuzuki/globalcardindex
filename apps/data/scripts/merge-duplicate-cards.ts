/**
 * merge-duplicate-cards.ts — 二重に登録されていた同じカードを1枚にまとめる
 *
 * 使い方（apps/data から実行）:
 *   node --env-file=.env.local --import tsx scripts/merge-duplicate-cards.ts                  # DRY-RUN
 *   BACKUP=<保存先.json> node --env-file=.env.local --import tsx scripts/merge-duplicate-cards.ts --apply
 *
 * 背景（2026-10-01）: カード番号の調査で、英語名で二重登録された日本版カード
 * （"SV2a 151 / Charizard ex" と "sv2a ポケモンカード151 / リザードンex" 等）や、
 * 別セットとして登録された同じカードが見つかった。価格はすべて円建て・日本の取引で、
 * 統合先と相場も近いことを確認済み。
 *
 * 状態（NM / PSA10 など）ごとに:
 *   - 統合先に同じ状態のカードがある → 価格・出品データ等を付け替え、統合元は
 *     非表示＋mergedIntoCardId を記録（既存の /api/admin/cards/merge と同じ方式。削除しない）
 *   - 同じ状態のカードが無い → 統合元の登録内容（セット・名前・レアリティ）を統合先に合わせて書き換える
 *
 * 付け替えないもの: IndexValue（指数の履歴）、SourceSearchUrl（カード固有の検索設定）、
 * 価格の元になっていない出品データ（英語名検索で拾った無関係な却下・保留の出品）。
 * ウォッチリスト・ポートフォリオは、同じ人が統合先も登録済みなら統合元に残す（削除しない）。
 */

import { prisma } from "@gci/db";
import { writeFileSync } from "fs";

type Key = { setName: string; name: string; rarity: string };
const PAIRS: { from: Key; to: Key }[] = [
  { from: { setName: "SV1 スカーレット", name: "Miraidon ex", rarity: "SAR" }, to: { setName: "sv1V バイオレットex", name: "ミライドンex", rarity: "SAR" } },
  { from: { setName: "SV1S バイオレット", name: "Gardevoir ex", rarity: "SAR" }, to: { setName: "sv1S スカーレットex", name: "サーナイトex", rarity: "SAR" } },
  { from: { setName: "sv2a", name: "ゲッコウガ ex", rarity: "SAR" }, to: { setName: "sv5a クリムゾンヘイズ", name: "ゲッコウガex", rarity: "SAR" } },
  { from: { setName: "SV2a 151", name: "Charizard ex", rarity: "SAR" }, to: { setName: "sv2a ポケモンカード151", name: "リザードンex", rarity: "SAR" } },
  { from: { setName: "SV2a 151", name: "Mew ex", rarity: "SAR" }, to: { setName: "sv2a ポケモンカード151", name: "ミュウex", rarity: "SAR" } },
  { from: { setName: "SV3 黒炎の支配者", name: "Charizard ex", rarity: "SAR" }, to: { setName: "sv3 黒炎の支配者", name: "リザードンex", rarity: "SAR" } },
  { from: { setName: "sv7a", name: "ブライア", rarity: "SAR" }, to: { setName: "sv7 ステラミラクル", name: "ブライア", rarity: "SAR" } },
  { from: { setName: "s12a VSTARユニバース", name: "アルセウスVSTAR", rarity: "SAR" }, to: { setName: "s12a VSTARユニバース", name: "アルセウスVSTAR", rarity: "UR" } },
  { from: { setName: "s8 フュージョンアーツ", name: "ゲンガーVMAX", rarity: "SA" }, to: { setName: "sGG", name: "ゲンガーVMAX", rarity: "SA" } },
];

const APPLY = process.argv.includes("--apply");
type Log = { action: string; table?: string; id: string; from?: string; to?: string; before?: Key };

async function main() {
  console.log(`mode: ${APPLY ? "APPLY（本番更新）" : "DRY-RUN（書き込みなし）"}\n`);
  const log: Log[] = [];

  for (const { from, to } of PAIRS) {
    const sources = await prisma.card.findMany({ where: { ...from, deletedAt: null }, select: { id: true, condition: true } });
    const targets = await prisma.card.findMany({ where: { ...to, deletedAt: null }, select: { id: true, condition: true, cardNumber: true } });
    console.log(`■ ${from.setName} / ${from.name} / ${from.rarity}  →  ${to.setName} / ${to.name} / ${to.rarity}`);
    const toNumber = targets.find((t) => t.cardNumber)?.cardNumber ?? null;

    for (const s of sources) {
      const t = targets.find((x) => x.condition === s.condition);
      const where = { cardId: s.id };
      const counts = {
        価格: await prisma.price.count({ where }),
        "ヤフオク(価格の元)": await prisma.rawAuctionResult.count({ where: { cardId: s.id, id: { in: (await prisma.price.findMany({ where, select: { fingerprint: true } })).map((x) => x.fingerprint ?? "").filter((f) => f.startsWith("rar:")).map((f) => f.slice(4)) } } }),
        "メルカリ(価格の元)": await prisma.rawMarketListing.count({ where: { cardId: s.id, url: { in: (await prisma.price.findMany({ where, select: { fingerprint: true } })).map((x) => x.fingerprint ?? "").filter((f) => f.startsWith("rml:")).map((f) => f.slice(4)) } } }),
        旧出品: await prisma.rawListing.count({ where }),
        eBay: await prisma.ebayListing.count({ where }),
        スナップショット: await prisma.priceSnapshot.count({ where }),
        別名: await prisma.cardAlias.count({ where }),
        ポートフォリオ: await prisma.portfolioCard.count({ where }),
        ウォッチ: (await prisma.watchlistItem.count({ where })) + (await prisma.userWatchlistItem.count({ where })),
      };
      const summary = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).join("・") || "紐づくデータなし";

      if (!t) {
        console.log(`  [${s.condition}] 統合先に同じ状態のカードなし → 登録内容を書き換え（${summary}）`);
        if (APPLY) {
          await prisma.card.update({ where: { id: s.id }, data: { setName: to.setName, name: to.name, rarity: to.rarity, ...(toNumber ? { cardNumber: toNumber } : {}) } });
          log.push({ action: "rename", id: s.id, before: from });
        }
        continue;
      }

      console.log(`  [${s.condition}] 統合（${summary}）`);
      if (!APPLY) continue;

      await prisma.$transaction(async (tx) => {
        const move = async (table: string, ids: string[], fn: () => Promise<unknown>) => {
          if (ids.length === 0) return;
          await fn();
          for (const id of ids) log.push({ action: "move", table, id, from: s.id, to: t.id });
        };
        const ids = async (q: Promise<{ id: string }[]>) => (await q).map((r) => r.id);
        const sel = { where, select: { id: true } } as const;

        const p = await ids(tx.price.findMany(sel));
        await move("Price", p, () => tx.price.updateMany({ where: { id: { in: p } }, data: { cardId: t.id } }));
        // 元の出品データは、価格データの元になったもの（fingerprint でつながるもの）だけ移す。
        // それ以外は英語名などで検索して拾った無関係な出品（却下・保留）なので、非表示の統合元に残す
        const fps = (await tx.price.findMany({ where: { id: { in: p } }, select: { fingerprint: true } }))
          .map((x) => x.fingerprint).filter((f): f is string => !!f);
        const rarIds = fps.filter((f) => f.startsWith("rar:")).map((f) => f.slice(4));
        const rmlUrls = fps.filter((f) => f.startsWith("rml:")).map((f) => f.slice(4));
        const ra = await ids(tx.rawAuctionResult.findMany({ where: { cardId: s.id, id: { in: rarIds } }, select: { id: true } }));
        await move("RawAuctionResult", ra, () => tx.rawAuctionResult.updateMany({ where: { id: { in: ra } }, data: { cardId: t.id } }));
        const rm = await ids(tx.rawMarketListing.findMany({ where: { cardId: s.id, url: { in: rmlUrls } }, select: { id: true } }));
        await move("RawMarketListing", rm, () => tx.rawMarketListing.updateMany({ where: { id: { in: rm } }, data: { cardId: t.id } }));
        const rl = await ids(tx.rawListing.findMany(sel));
        await move("RawListing", rl, () => tx.rawListing.updateMany({ where: { id: { in: rl } }, data: { cardId: t.id } }));
        const eb = await ids(tx.ebayListing.findMany(sel));
        await move("EbayListing", eb, () => tx.ebayListing.updateMany({ where: { id: { in: eb } }, data: { cardId: t.id } }));
        const sn = await ids(tx.priceSnapshot.findMany(sel));
        await move("PriceSnapshot", sn, () => tx.priceSnapshot.updateMany({ where: { id: { in: sn } }, data: { cardId: t.id } }));
        const al = await ids(tx.cardAlias.findMany(sel));
        await move("CardAlias", al, () => tx.cardAlias.updateMany({ where: { id: { in: al } }, data: { cardId: t.id } }));

        // 一人1枚の制約があるもの: 統合先に同じ人の登録が無いものだけ付け替える
        for (const pc of await tx.portfolioCard.findMany({ where, select: { id: true, userId: true } })) {
          const dup = await tx.portfolioCard.findFirst({ where: { userId: pc.userId, cardId: t.id }, select: { id: true } });
          if (dup) { console.log(`    ポートフォリオ ${pc.id} は統合先にも同じ人の登録があるため統合元に残す`); continue; }
          await tx.portfolioCard.update({ where: { id: pc.id }, data: { cardId: t.id } });
          log.push({ action: "move", table: "PortfolioCard", id: pc.id, from: s.id, to: t.id });
        }
        for (const w of await tx.watchlistItem.findMany({ where, select: { id: true, watchlistId: true } })) {
          const dup = await tx.watchlistItem.findFirst({ where: { watchlistId: w.watchlistId, cardId: t.id }, select: { id: true } });
          if (dup) continue;
          await tx.watchlistItem.update({ where: { id: w.id }, data: { cardId: t.id } });
          log.push({ action: "move", table: "WatchlistItem", id: w.id, from: s.id, to: t.id });
        }
        for (const w of await tx.userWatchlistItem.findMany({ where, select: { id: true, userId: true } })) {
          const dup = await tx.userWatchlistItem.findFirst({ where: { userId: w.userId, cardId: t.id }, select: { id: true } });
          if (dup) continue;
          await tx.userWatchlistItem.update({ where: { id: w.id }, data: { cardId: t.id } });
          log.push({ action: "move", table: "UserWatchlistItem", id: w.id, from: s.id, to: t.id });
        }

        await tx.card.update({ where: { id: s.id }, data: { isVisible: false, mergedIntoCardId: t.id } });
        log.push({ action: "hide", id: s.id, to: t.id });
      }, { timeout: 60000 });
    }
    console.log("");
  }

  if (APPLY) {
    const path = process.env.BACKUP ?? `merge-backup-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
    console.log(`バックアップ: ${path}（記録 ${log.length}行）`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
