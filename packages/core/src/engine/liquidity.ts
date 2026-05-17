/**
 * Future: liquidity weighting (volume × frequency) used by GCI100 and
 * sub-indices. Kept as a typed placeholder so callers don't reshape later.
 */

export type LiquidityInput = {
  dataPoints: number;
  windowDays: number;
};

export function naiveLiquidityScore({
  dataPoints,
  windowDays,
}: LiquidityInput): number {
  if (windowDays <= 0) return 0;
  return dataPoints / windowDays;
}
