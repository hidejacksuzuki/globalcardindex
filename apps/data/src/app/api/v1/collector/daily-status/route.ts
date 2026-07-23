/**
 * GET /api/v1/collector/daily-status
 *
 * Returns today's collection pipeline status for the daily dashboard.
 *
 * Response shape:
 * {
 *   ok: true,
 *   data: {
 *     date:           "2026-05-12",
 *     sessions: {
 *       total:        number,   // CollectorRun sessions created today
 *       items:        number,   // total items across all sessions
 *       pending:      number,   // awaiting review
 *       approved:     number,   // imported into prices
 *       filtered:     number,   // auto-rejected by filters
 *       error:        number,
 *     },
 *     recalc: {
 *       lastRunAt:    string | null,   // ISO timestamp of last RecalcLog
 *       lastValue:    number | null,
 *       lastChangeRate: number | null,
 *       status:       "success" | "error" | "no_data" | "never",
 *     },
 *     watchlistCount: number,   // active cards in watchlist.csv
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";
import { readFileSync }              from "node:fs";
import { resolve }                   from "node:path";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (
    secret.length >= 16 &&
    auth.startsWith("Bearer ") &&
    timingSafeEqual(auth.slice(7).trim(), secret)
  ) return true;
  const referer = req.headers.get("referer") ?? "";
  return referer.includes("/admin/") || process.env.NODE_ENV !== "production";
}

function countWatchlist(): number {
  try {
    const csvPath = resolve(process.cwd(), "../../data/watchlist.csv");
    const csv = readFileSync(csvPath, "utf-8");
    return csv.split("\n").filter((l, i) => i > 0 && l.trim()).length;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now      = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // パフォーマンス (2026-07-23): 以前は createdAt で絞っていたが、RawAuctionResult は
  // 70万行あり createdAt にインデックスが無いため毎回フルスキャンで ~24秒かかっていた。
  // capturedAt はインデックス済みで値も createdAt と同一（挿入時に同時設定・実測差0秒）。
  // 「今日“収集”したもの」という意味的にも capturedAt が正しいため、全て capturedAt に統一。

  // ── Today's RawListing stats (bookmarklet / import) ──────────────────────
  const [
    totalItems,
    pendingItems,
    approvedItems,
    rejectedItems,
  ] = await Promise.all([
    prisma.rawListing.count({ where: { capturedAt: { gte: todayStart } } }),
    prisma.rawListing.count({ where: { capturedAt: { gte: todayStart }, status: "pending" } }),
    prisma.rawListing.count({ where: { capturedAt: { gte: todayStart }, status: "approved" } }),
    prisma.rawListing.count({ where: { capturedAt: { gte: todayStart }, status: "rejected" } }),
  ]);

  // CollectorRun は旧フロー互換で残す（セッション数のみ参照）
  const sessionIds = await prisma.collectorRun.findMany({
    where:   { createdAt: { gte: todayStart } },
    select:  { sessionId: true },
    distinct: ["sessionId"],
  });

  const filteredItems = rejectedItems;
  const errorItems    = 0;

  // ── Today's RawAuctionResult stats (server-side Yahoo cron) ─────────────
  // status 別カウントは 3 回の count を 1 回の groupBy に集約（今日分を 3 回
  // スキャンせず 1 回で済ませる）。
  const [auctionByStatus, yahooLastRow] = await Promise.all([
    prisma.rawAuctionResult.groupBy({
      by:     ["status"],
      where:  { capturedAt: { gte: todayStart }, source: "yahoo_auction_closed" },
      _count: { _all: true },
    }),
    prisma.rawAuctionResult.findFirst({
      where:   { source: "yahoo_auction_closed" },
      orderBy: { capturedAt: "desc" },
      select:  { capturedAt: true },
    }),
  ]);
  const auctionCount = (status?: string): number =>
    status
      ? auctionByStatus.find((r) => r.status === status)?._count._all ?? 0
      : auctionByStatus.reduce((sum, r) => sum + r._count._all, 0);
  const yahooTotal    = auctionCount();
  const yahooApproved = auctionCount("approved");
  const yahooPending  = auctionCount("pending");

  // ── Last RecalcLog ────────────────────────────────────────────────────────
  const lastRecalc = await prisma.recalcLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt:  true,
      status:     true,
      value:      true,
      changeRate: true,
    },
  });

  const recalcStatus = lastRecalc
    ? (lastRecalc.status as "success" | "error" | "no_data")
    : "never";

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    data: {
      date:           now.toISOString().slice(0, 10),
      sessions: {
        total:    sessionIds.length,
        items:    totalItems,
        pending:  pendingItems,
        approved: approvedItems,
        filtered: filteredItems,
        error:    errorItems,
      },
      yahoo: {
        total:      yahooTotal,
        approved:   yahooApproved,
        pending:    yahooPending,
        lastCardAt: yahooLastRow?.capturedAt?.toISOString() ?? null,
      },
      recalc: {
        lastRunAt:      lastRecalc?.createdAt?.toISOString() ?? null,
        lastValue:      lastRecalc?.value ?? null,
        lastChangeRate: lastRecalc?.changeRate ?? null,
        status:         recalcStatus,
      },
      watchlistCount: countWatchlist(),
    },
  });
}
