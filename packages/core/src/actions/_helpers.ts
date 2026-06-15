import type { Prisma } from "@prisma/client";

// ----------------------------------------------------------------
// Trust threshold
// ----------------------------------------------------------------

/** trustScore がこの値を下回ると LOW_TRUST として除外 */
export const TRUST_THRESHOLD = 30;

// ----------------------------------------------------------------
// Rejection reasons
// ----------------------------------------------------------------

export type RejectionReason = "OUTLIER_IQR" | "STALE_48H" | "LOW_TRUST";

export function computeRejectionReasons(p: {
  isOutlier:  boolean;
  isStale:    boolean;
  trustScore: number;
}): RejectionReason[] {
  const reasons: RejectionReason[] = [];
  if (p.isOutlier)                    reasons.push("OUTLIER_IQR");
  if (p.isStale)                      reasons.push("STALE_48H");
  if (p.trustScore < TRUST_THRESHOLD) reasons.push("LOW_TRUST");
  return reasons;
}

// ----------------------------------------------------------------
// Card search WHERE clause (shared by listCards / getMarketboard)
// ----------------------------------------------------------------

/**
 * 公開サイト用の Card WHERE 句。
 * 非表示・削除済み・統合済みカードを自動的に除外する。
 */
export function buildCardSearchWhere(
  search?: string,
): Prisma.CardWhereInput {
  const base: Prisma.CardWhereInput = {
    isVisible: true,
    deletedAt: null,
  };
  const trimmed = search?.trim();
  if (!trimmed) return base;
  return {
    ...base,
    OR: [
      { name:    { contains: trimmed, mode: "insensitive" } },
      { setName: { contains: trimmed, mode: "insensitive" } },
    ],
  };
}

/**
 * 管理画面用の Card WHERE 句。
 * 削除済みカードの表示/非表示をオプションで切り替え可能。
 */
export function buildAdminCardWhere(opts: {
  search?:       string;
  showDeleted?:  boolean;
  showHidden?:   boolean;
}): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};
  if (!opts.showDeleted) where.deletedAt = null;
  if (!opts.showHidden)  where.isVisible = true;

  const trimmed = opts.search?.trim();
  if (trimmed) {
    where.OR = [
      { name:    { contains: trimmed, mode: "insensitive" } },
      { setName: { contains: trimmed, mode: "insensitive" } },
    ];
  }
  return where;
}

// ----------------------------------------------------------------
// Index periods
// ----------------------------------------------------------------

export const INDEX_PERIODS = [7, 30, 90] as const;
export type  IndexPeriodDays = typeof INDEX_PERIODS[number];
