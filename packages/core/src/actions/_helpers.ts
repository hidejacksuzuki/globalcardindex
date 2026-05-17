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

export function buildCardSearchWhere(
  search?: string,
): Prisma.CardWhereInput | undefined {
  const trimmed = search?.trim();
  if (!trimmed) return undefined;
  return {
    OR: [
      { name:    { contains: trimmed, mode: "insensitive" } },
      { setName: { contains: trimmed, mode: "insensitive" } },
    ],
  };
}

// ----------------------------------------------------------------
// Index periods
// ----------------------------------------------------------------

export const INDEX_PERIODS = [7, 30, 90] as const;
export type  IndexPeriodDays = typeof INDEX_PERIODS[number];
