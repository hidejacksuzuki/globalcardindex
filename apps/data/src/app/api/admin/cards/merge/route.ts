/**
 * POST /api/admin/cards/merge
 *
 * 複数カードを1枚の「親カード」に統合する。
 * 価格・Watchlist・インデックス値などを親に付け替え、子を merged 状態にする。
 *
 * Body:
 *   { parentId: string, childIds: string[] }
 *
 * 統合後の子カード状態:
 *   - isVisible: false
 *   - mergedIntoCardId: parentId
 *   - deletedAt: 設定しない（履歴確認できるよう残す）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@gci/db";
import { timingSafeEqual }           from "@gci/core";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const auth   = req.headers.get("authorization") ?? "";
  if (secret.length >= 16 && auth.startsWith("Bearer ") &&
      timingSafeEqual(auth.slice(7).trim(), secret)) return true;
  return process.env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { parentId: string; childIds: string[] };

  if (!body.parentId || !Array.isArray(body.childIds) || body.childIds.length === 0) {
    return NextResponse.json({ ok: false, error: "parentId and childIds[] are required" }, { status: 400 });
  }
  if (body.childIds.includes(body.parentId)) {
    return NextResponse.json({ ok: false, error: "parentId cannot be in childIds" }, { status: 400 });
  }

  const [parent, children] = await Promise.all([
    prisma.card.findUnique({ where: { id: body.parentId } }),
    prisma.card.findMany({ where: { id: { in: body.childIds } } }),
  ]);

  if (!parent) return NextResponse.json({ ok: false, error: "parent card not found" }, { status: 404 });
  if (children.length !== body.childIds.length) {
    return NextResponse.json({ ok: false, error: "some child cards not found" }, { status: 404 });
  }

  const stats = { prices: 0, watchlist: 0, userWatchlist: 0, indexValues: 0, rawListings: 0 };

  // トランザクションで一括処理
  await prisma.$transaction(async (tx) => {
    for (const childId of body.childIds) {
      // Price → 親に付け替え（fingerprint 衝突を避けるため try/catch）
      const priceResult = await tx.price.updateMany({
        where: { cardId: childId },
        data:  { cardId: body.parentId },
      }).catch(() => ({ count: 0 }));
      stats.prices += priceResult.count;

      // WatchlistItem → 親に付け替え（重複があればスキップ）
      const watchlistItems = await tx.watchlistItem.findMany({
        where: { cardId: childId },
      });
      for (const item of watchlistItems) {
        const exists = await tx.watchlistItem.findUnique({
          where: { watchlistId_cardId: { watchlistId: item.watchlistId, cardId: body.parentId } },
        });
        if (!exists) {
          await tx.watchlistItem.update({
            where: { id: item.id },
            data:  { cardId: body.parentId },
          });
          stats.watchlist++;
        } else {
          await tx.watchlistItem.delete({ where: { id: item.id } });
        }
      }

      // UserWatchlistItem → 親に付け替え
      const userWatchlistItems = await tx.userWatchlistItem.findMany({
        where: { cardId: childId },
      });
      for (const item of userWatchlistItems) {
        const exists = await tx.userWatchlistItem.findUnique({
          where: { userId_cardId: { userId: item.userId, cardId: body.parentId } },
        });
        if (!exists) {
          await tx.userWatchlistItem.update({
            where: { id: item.id },
            data:  { cardId: body.parentId },
          });
          stats.userWatchlist++;
        } else {
          await tx.userWatchlistItem.delete({ where: { id: item.id } });
        }
      }

      // IndexValue → 親に付け替え（古いデータとして残す）
      const ivResult = await tx.indexValue.updateMany({
        where: { cardId: childId },
        data:  { cardId: body.parentId },
      }).catch(() => ({ count: 0 }));
      stats.indexValues += ivResult.count;

      // RawListing → 親に付け替え
      const rlResult = await tx.rawListing.updateMany({
        where: { cardId: childId },
        data:  { cardId: body.parentId },
      }).catch(() => ({ count: 0 }));
      stats.rawListings += rlResult.count;

      // 子カードを merged 状態に
      await tx.card.update({
        where: { id: childId },
        data: {
          isVisible:        false,
          mergedIntoCardId: body.parentId,
        },
      });
    }
  });

  return NextResponse.json({
    ok:       true,
    parentId: body.parentId,
    merged:   body.childIds.length,
    stats,
  });
}
