// GCI Index actions — data access for IndexValue.
// Imported as `@/actions` (index.ts is the default module of the directory).
// Pages and the v1 API route share these functions.

import { prisma } from "@/lib/prisma";
import type { IndexSnapshot } from "@/types";

export const INDEX_PERIODS = [7, 30, 90] as const;
export type  IndexPeriodDays = typeof INDEX_PERIODS[number];

// ----------------------------------------------------------------
// getLatestIndex
// ----------------------------------------------------------------
export async function getLatestIndex(): Promise<IndexSnapshot | null> {
  const latest = await prisma.indexValue.findFirst({
    orderBy: { calculatedAt: "desc" },
  });
  if (!latest) return null;
  return {
    value:        latest.value,
    changeRate:   latest.changeRate,
    calculatedAt: latest.calculatedAt.toISOString(),
  };
}

// ----------------------------------------------------------------
// getIndexHistory
// days: 何日分を取得するか（7 / 30 / 90）
// 戻り値は新しい順。IndexHero のスパークラインは .reverse() で使う。
// ----------------------------------------------------------------
export async function getIndexHistory(
  days: IndexPeriodDays = 30,
): Promise<IndexSnapshot[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.indexValue.findMany({
    where:   { calculatedAt: { gte: since } },
    orderBy: { calculatedAt: "desc" },
    // 1時間足想定で最大 days * 24 件
    take: days * 24,
  });

  return rows.map((r) => ({
    value:        r.value,
    changeRate:   r.changeRate,
    calculatedAt: r.calculatedAt.toISOString(),
  }));
}

// ----------------------------------------------------------------
// getPreviousDaySnapshot
// 前日比を出すために24時間前に最も近いスナップショットを返す
// ----------------------------------------------------------------
export async function getPreviousDaySnapshot(): Promise<IndexSnapshot | null> {
  const target = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const row = await prisma.indexValue.findFirst({
    where:   { calculatedAt: { lte: target } },
    orderBy: { calculatedAt: "desc" },
  });

  if (!row) return null;
  return {
    value:        row.value,
    changeRate:   row.changeRate,
    calculatedAt: row.calculatedAt.toISOString(),
  };
}
