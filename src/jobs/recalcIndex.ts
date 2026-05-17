import { prisma }          from "@/lib/prisma";
import { calculateIndex }  from "@/lib/engine/indexCalculator";
import { markStalePrices } from "@/lib/engine/staleDetector";

export type RecalcResult =
  | { saved: false; reason: string }
  | {
      saved:        true;
      id:           string;
      value:        number;
      changeRate:   number;
      sampleCount:  number;
      outlierCount: number;
      stale:        { flagged: number; unflagged: number };
    };

export type RecalcTrigger = "cron" | "manual";

/**
 * Recompute the GCI index value, persist a new IndexValue row,
 * and write a RecalcLog entry for every run (success, no-data, or error).
 */
export async function recalcIndex(
  triggeredBy: RecalcTrigger = "cron",
): Promise<RecalcResult> {
  const startedAt = Date.now();

  try {
    // ── 1. stale detection ──
    const stale = await markStalePrices();

    // ── 2. インデックス計算 ──
    const result = await calculateIndex();

    if (!result) {
      await prisma.recalcLog.create({
        data: {
          status:        "no_data",
          triggeredBy,
          durationMs:    Date.now() - startedAt,
          staleFlagged:   stale.flagged,
          staleUnflagged: stale.unflagged,
        },
      });
      return { saved: false, reason: "no prices in window" };
    }

    // ── 3. IndexValue 保存 ──
    const stored = await prisma.indexValue.create({
      data: {
        value:      result.value,
        changeRate: result.changeRate,
      },
    });

    // ── 4. RecalcLog 保存 ──
    await prisma.recalcLog.create({
      data: {
        status:        "success",
        triggeredBy,
        durationMs:    Date.now() - startedAt,
        indexValueId:  stored.id,
        value:         stored.value,
        changeRate:    stored.changeRate,
        sampleCount:   result.sampleCount,
        outlierCount:  result.outlierCount,
        staleFlagged:   stale.flagged,
        staleUnflagged: stale.unflagged,
      },
    });

    return {
      saved:        true,
      id:           stored.id,
      value:        stored.value,
      changeRate:   stored.changeRate,
      sampleCount:  result.sampleCount,
      outlierCount: result.outlierCount,
      stale,
    };
  } catch (err) {
    // ── エラー時もログを残す ──
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.recalcLog.create({
      data: {
        status:      "error",
        triggeredBy,
        durationMs:  Date.now() - startedAt,
        errorMessage,
      },
    });
    throw err; // 呼び出し元にも伝播
  }
}
