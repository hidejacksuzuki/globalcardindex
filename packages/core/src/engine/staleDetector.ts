import { prisma } from "@gci/db";

// ----------------------------------------------------------------
// Stale Detection
//
// N 時間以上 capturedAt が更新されていない Price を stale とみなし
// isStale = true にフラグを立てる。
//
// 「収集が止まっているカード」を指数計算から自動除外するための仕組み。
// ----------------------------------------------------------------

export const DEFAULT_STALE_HOURS = 48; // 48 時間更新なし → stale

export type StaleDetectionResult = {
  flagged:   number; // 今回 stale にしたレコード数
  unflagged: number; // 今回 stale を解除したレコード数
};

/**
 * markStaleprices
 *
 * - `staleHours` 以上前に capturedAt が止まっているカードの価格を isStale=true に
 * - 最近更新があるカードの価格は isStale=false に戻す（自動回復）
 */
export async function markStalePrices(
  staleHours: number = DEFAULT_STALE_HOURS,
): Promise<StaleDetectionResult> {
  const threshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  // ── カードごとの最新 capturedAt を集計 ──
  // capturedAt が threshold より古いカードを stale とみなす
  const cardGroups = await prisma.price.groupBy({
    by:      ["cardId"],
    _max:    { capturedAt: true },
  });

  const staleCardIds:   string[] = [];
  const freshCardIds:   string[] = [];

  for (const g of cardGroups) {
    const latest = g._max.capturedAt;
    if (!latest) continue;
    if (latest < threshold) {
      staleCardIds.push(g.cardId);
    } else {
      freshCardIds.push(g.cardId);
    }
  }

  // ── stale フラグを立てる ──
  const flagResult = staleCardIds.length > 0
    ? await prisma.price.updateMany({
        where: { cardId: { in: staleCardIds }, isStale: false },
        data:  { isStale: true },
      })
    : { count: 0 };

  // ── stale を解除する（収集が再開したカード）──
  const unflagResult = freshCardIds.length > 0
    ? await prisma.price.updateMany({
        where: { cardId: { in: freshCardIds }, isStale: true },
        data:  { isStale: false },
      })
    : { count: 0 };

  return {
    flagged:   flagResult.count,
    unflagged: unflagResult.count,
  };
}

/**
 * getStaleCards
 * stale なカードの一覧を返す（管理画面・アラート用）
 */
export async function getStaleCards() {
  const threshold = new Date(Date.now() - DEFAULT_STALE_HOURS * 60 * 60 * 1000);

  return prisma.price.groupBy({
    by:     ["cardId"],
    _max:   { capturedAt: true },
    having: { capturedAt: { _max: { lt: threshold } } },
  });
}
