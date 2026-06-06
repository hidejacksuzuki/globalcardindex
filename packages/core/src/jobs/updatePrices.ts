/**
 * updatePrices.ts
 *
 * Yahoo オークション落札データをサーバーサイドで収集し、
 * RawAuctionResult に保存する。Chrome 拡張不要。
 *
 * 設計:
 *   - DB の全カードを updatedAt 昇順でソートし batchSize 件ずつ処理
 *   - 1件ごとに RATE_LIMIT_MS 待機してヤフオクへの負荷を抑制
 *   - matchScore >= AUTO_APPROVE_SCORE は即時承認 + Price 作成
 */

import { prisma }  from "@gci/db";
import { fetchClosedAuctions }   from "../collectors/yahoo-auction-server";
import { calcAuctionScore, buildYahooAuctionUrls } from "../collectors/yahoo-auction";
import { autoVerdict }           from "../collectors/scoring";

const RATE_LIMIT_MS      = 2500;
const DEFAULT_BATCH      = 20;
const AUTO_APPROVE_SCORE = 75;

export type UpdatePricesResult = {
  processed:    number;
  saved:        number;
  skipped:      number;
  autoApproved: number;
  errors:       string[];
};

export async function updatePrices(options?: {
  batchSize?: number;
  dryRun?:    boolean;
}): Promise<UpdatePricesResult> {
  const { batchSize = DEFAULT_BATCH, dryRun = false } = options ?? {};

  const result: UpdatePricesResult = {
    processed:    0,
    saved:        0,
    skipped:      0,
    autoApproved: 0,
    errors:       [],
  };

  // 最も古く収集されたカードから処理
  const cards = await prisma.card.findMany({
    orderBy: { updatedAt: "asc" },
    take:    batchSize,
    select:  { id: true, name: true, rarity: true, setName: true },
  });

  for (const card of cards) {
    result.processed++;

    try {
      const { keyword } = buildYahooAuctionUrls(card.name, card.rarity, card.setName);

      if (dryRun) {
        await prisma.card.update({ where: { id: card.id }, data: { updatedAt: new Date() } });
        continue;
      }

      const items = await fetchClosedAuctions(keyword, 20);

      for (const item of items) {
        const { matchScore, trustScore } = calcAuctionScore(
          item.title,
          { name: card.name, rarity: card.rarity, setName: card.setName },
          true,
          item.bidCount,
        );

        const verdict = autoVerdict(matchScore);
        if (verdict === "rejected") { result.skipped++; continue; }

        const isAutoApprove = matchScore >= AUTO_APPROVE_SCORE;

        try {
          await prisma.rawAuctionResult.create({
            data: {
              cardId:    card.id,
              source:    "yahoo_auction_closed",
              title:     item.title,
              price:     Math.round(item.price),
              url:       item.url,
              bidCount:  item.bidCount ?? null,
              endedAt:   item.endedAt ? new Date(item.endedAt) : null,
              matchScore,
              trustScore,
              status:    isAutoApprove ? "approved" : "pending",
            },
          });
          result.saved++;

          if (isAutoApprove) {
            await prisma.price.create({
              data: {
                cardId:      card.id,
                price:       Math.round(item.price),
                observedAt:  item.endedAt ? new Date(item.endedAt) : new Date(),
                sourceType:  "yahoo_auction_closed",
                sourceName:  "yahoo_auction",
                fingerprint: `srv:yah:${item.url}:${item.price}`,
              },
            }).catch(() => {});
            result.autoApproved++;
          }
        } catch {
          result.skipped++; // fingerprint 重複など
        }
      }

      // updatedAt を更新（ローテーション用）
      await prisma.card.update({ where: { id: card.id }, data: { updatedAt: new Date() } });

      // レート制限
      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      result.errors.push(`${card.name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
