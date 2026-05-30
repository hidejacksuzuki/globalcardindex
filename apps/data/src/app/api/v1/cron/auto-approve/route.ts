/**
 * POST /api/v1/cron/auto-approve
 *
 * matchScore >= AUTO_APPROVE_THRESHOLD の pending 件を自動承認し
 * Price レコードを作成する。
 *
 * 対象:
 *   - RawListing   (mercari など)
 *   - RawAuctionResult (yahoo_auction_closed)
 *
 * Auth: CRON_SECRET
 * Schedule: 毎時 15 分 (vercel.json)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { authorizeCron, writeCronLog } from "@gci/core";

export const dynamic = "force-dynamic";

/** この閾値以上は人手レビューなしで承認 */
const AUTO_APPROVE_THRESHOLD = 75;

// ── 中央値 ─────────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

// ── メイン ─────────────────────────────────────────────────────────────────────

async function handle(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const startAt   = Date.now();
  const threshold = Number(req.nextUrl.searchParams.get("threshold") ?? AUTO_APPROVE_THRESHOLD);
  const dryRun    = req.nextUrl.searchParams.get("dry") === "1";

  try {
    const result = await autoApprove(threshold, dryRun);
    const durationMs = Date.now() - startAt;
    await writeCronLog("auto-approve", "ok", { durationMs, threshold, dryRun, ...result });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await writeCronLog("auto-approve", "error", {
      durationMs: Date.now() - startAt, errorMessage: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET  = handle;
export const POST = handle;

// ── 自動承認ロジック ───────────────────────────────────────────────────────────

async function autoApprove(threshold: number, dryRun: boolean) {
  // 1. RawListing (mercari 等) の pending 件を取得
  const pendingListings = await prisma.rawListing.findMany({
    where: {
      status:     "pending",
      matchScore: { gte: threshold },
    },
    select: { id: true, cardId: true, price: true, source: true, createdAt: true, matchScore: true },
  });

  // 2. RawAuctionResult (yahoo_auction_closed) の pending 件を取得
  const pendingAuctions = await prisma.rawAuctionResult.findMany({
    where: {
      status:     "pending",
      source:     "yahoo_auction_closed",
      matchScore: { gte: threshold },
    },
    select: { id: true, cardId: true, price: true, source: true, endedAt: true, capturedAt: true, matchScore: true },
  });

  const listingCount = pendingListings.length;
  const auctionCount = pendingAuctions.length;

  if (dryRun) {
    return {
      dryRun:        true,
      listingsWould: listingCount,
      auctionsWould: auctionCount,
    };
  }

  // 3. RawListing を承認
  let listingsApproved = 0;
  if (listingCount > 0) {
    const ids = pendingListings.map((l) => l.id);
    await prisma.rawListing.updateMany({
      where: { id: { in: ids } },
      data:  { status: "approved" },
    });

    // Price レコードを作成
    await prisma.price.createMany({
      data: pendingListings.map((r) => ({
        cardId:      r.cardId,
        price:       r.price,
        observedAt:  r.createdAt,
        sourceType:  r.source,
        sourceName:  r.source,
        fingerprint: `rl:${r.id}`,
      })),
      skipDuplicates: true,
    });
    listingsApproved = listingCount;
  }

  // 4. RawAuctionResult を承認
  let auctionsApproved = 0;
  if (auctionCount > 0) {
    const ids = pendingAuctions.map((a) => a.id);
    await prisma.rawAuctionResult.updateMany({
      where: { id: { in: ids } },
      data:  { status: "approved" },
    });

    // Price レコードを作成
    await prisma.price.createMany({
      data: pendingAuctions.map((r) => ({
        cardId:      r.cardId,
        price:       r.price,
        observedAt:  r.endedAt ?? r.capturedAt,
        sourceType:  "yahoo_auction_closed",
        sourceName:  "yahoo_auction",
        fingerprint: `rar:${r.id}`,
      })),
      skipDuplicates: true,
    });
    auctionsApproved = auctionCount;
  }

  // 5. 承認したカードごとに PriceSnapshot を再計算
  const allCardIds = [
    ...new Set([
      ...pendingListings.map((l) => l.cardId),
      ...pendingAuctions.map((a) => a.cardId),
    ]),
  ];

  let snapshotsCreated = 0;
  for (const cardId of allCardIds) {
    // mercari snapshot
    const mercariApproved = await prisma.rawListing.findMany({
      where:  { cardId, status: "approved" },
      select: { price: true },
    });
    if (mercariApproved.length > 0) {
      const prices  = mercariApproved.map((l) => l.price);
      const sorted  = [...prices].sort((a, b) => a - b);
      const trimmed = sorted.slice(0, Math.ceil(sorted.length * 0.9));
      await prisma.priceSnapshot.create({
        data: {
          cardId,
          source:        "mercari",
          minPrice:      sorted[0],
          medianPrice:   median(prices),
          avgPrice:      Math.round(trimmed.reduce((s, p) => s + p, 0) / trimmed.length),
          maxPrice:      sorted[sorted.length - 1],
          sampleCount:   prices.length,
          approvedCount: prices.length,
        },
      }).catch(() => {}); // snapshot は best-effort
    }

    // yahoo closed snapshot
    const yahooApproved = await prisma.rawAuctionResult.findMany({
      where:  { cardId, source: "yahoo_auction_closed", status: "approved" },
      select: { price: true },
    });
    if (yahooApproved.length > 0) {
      const prices  = yahooApproved.map((l) => l.price);
      const sorted  = [...prices].sort((a, b) => a - b);
      const trimmed = sorted.slice(0, Math.ceil(sorted.length * 0.9));
      await prisma.priceSnapshot.create({
        data: {
          cardId,
          source:        "yahoo_auction_closed",
          minPrice:      sorted[0],
          medianPrice:   median(prices),
          avgPrice:      Math.round(trimmed.reduce((s, p) => s + p, 0) / trimmed.length),
          maxPrice:      sorted[sorted.length - 1],
          sampleCount:   prices.length,
          approvedCount: prices.length,
        },
      }).catch(() => {});
      snapshotsCreated++;
    }
  }

  return {
    threshold,
    listingsApproved,
    auctionsApproved,
    cardsUpdated:    allCardIds.length,
    snapshotsCreated,
  };
}
