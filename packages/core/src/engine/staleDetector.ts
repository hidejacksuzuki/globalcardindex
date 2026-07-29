import { prisma } from "@gci/db";

// ----------------------------------------------------------------
// Stale Detection
//
// 「収集が止まっているカード」の価格を指数計算から自動除外する仕組み。
// N 時間以上 収集されていないカードの Price に isStale = true を立てる。
//
// 判定基準は Card.updatedAt（収集ハートビート）。
// updatePrices は 1 カード処理するたびに、新しい価格が取れたかどうかに
// かかわらず Card.updatedAt を更新する（jobs/updatePrices.ts のローテーション用）。
// つまり「最後にそのカードを収集しに行った時刻」であり、収集の生死を正しく表す。
//
// ※ 以前は max(Price.capturedAt)（＝最後に新しい価格行が入った時刻）で
//    判定していたが、Price は fingerprint で重複排除されるため、同じ出品を
//    再収集しても行は増えない。結果この指標は「直近に新規取引が発生したか」を
//    測っており、数週間売れないカード（トレカでは普通）が収集正常でも stale に
//    落ちていた。2026-07-29 の実測では stale 判定 704 カード全てが
//    「収集は 48h 以内に回っている」もので、誤判定率 100% だった。
// ----------------------------------------------------------------

export const DEFAULT_STALE_HOURS = 48; // 48 時間収集されていない → stale

export type StaleDetectionResult = {
  flagged:   number; // 今回 stale にしたレコード数
  unflagged: number; // 今回 stale を解除したレコード数
};

/**
 * markStalePrices
 *
 * - `staleHours` 以上収集されていないカード（Card.updatedAt が古い）の価格を isStale=true に
 * - 収集が回っているカードの価格は isStale=false に戻す（自動回復）
 */
export async function markStalePrices(
  staleHours: number = DEFAULT_STALE_HOURS,
): Promise<StaleDetectionResult> {
  const threshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  // ── 収集ハートビート（Card.updatedAt）で stale / fresh を振り分け ──
  const [staleCards, freshCards] = await Promise.all([
    prisma.card.findMany({
      where:  { updatedAt: { lt:  threshold } },
      select: { id: true },
    }),
    prisma.card.findMany({
      where:  { updatedAt: { gte: threshold } },
      select: { id: true },
    }),
  ]);

  const staleCardIds = staleCards.map((c) => c.id);
  const freshCardIds = freshCards.map((c) => c.id);

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
 * stale なカード（＝収集が止まっているカード）の一覧を返す（管理画面・アラート用）。
 * markStalePrices と同じ基準（Card.updatedAt）で判定する。
 */
export async function getStaleCards() {
  const threshold = new Date(Date.now() - DEFAULT_STALE_HOURS * 60 * 60 * 1000);

  return prisma.card.findMany({
    where:   { updatedAt: { lt: threshold } },
    select:  { id: true, name: true, setName: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });
}
