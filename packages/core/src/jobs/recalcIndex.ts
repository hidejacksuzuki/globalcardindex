import { prisma }                                    from "@gci/db";
import { calculateIndex, calculateCardIndex }        from "../engine/indexCalculator";
import { markStalePrices }                           from "../engine/staleDetector";
import { postMarketAlerts, postCollectorLog }        from "../social/discordAlerts";

export type RecalcTrigger = "cron" | "manual";

// ----------------------------------------------------------------
// Global recalc result (unchanged shape for backward compat)
// ----------------------------------------------------------------
export type RecalcResult =
  | { saved: false; reason: string }
  | {
      saved:          true;
      id:             string;
      value:          number;
      changeRate:     number;
      sampleCount:    number;
      outlierCount:   number;
      confidence:     string;
      stale:          { flagged: number; unflagged: number };
      cards:          CardRecalcSummary;
    };

// ----------------------------------------------------------------
// Per-card breakdown types
// ----------------------------------------------------------------
export type CardRecalcStatus = "updated" | "skipped" | "no_data" | "failed";

export type CardRecalcEntry = {
  cardId:       string;
  name:         string;
  condition:    string;
  status:       CardRecalcStatus;
  sampleCount:  number;
  outlierCount: number;
  value:        number | null;
  changeRate:   number | null;
  confidence:   string | null;
  error?:       string;
};

export type CardRecalcSummary = {
  processed: number;
  updated:   number;
  skipped:   number;
  noData:    number;
  failed:    number;
  entries:   CardRecalcEntry[];
};

// ----------------------------------------------------------------
// Concurrency + retry helpers
// ----------------------------------------------------------------

const CARD_CONCURRENCY  = 5; // 同時実行数（timeout対策のためのバッチ処理）
const CARD_MAX_RETRIES  = 1; // 1回まで自動リトライ

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function runInBatches<T, R>(
  items:       T[],
  concurrency: number,
  fn:          (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ----------------------------------------------------------------
// recalcCardIndex — recalculate index for a single card
// ----------------------------------------------------------------
export async function recalcCardIndex(
  cardId:      string,
  triggeredBy: RecalcTrigger = "manual",
): Promise<CardRecalcEntry | null> {
  const card = await prisma.card.findUnique({
    where:  { id: cardId },
    select: { id: true, name: true, condition: true },
  });
  if (!card) return null;

  const result = await calculateCardIndex(cardId);

  if (!result) {
    return {
      cardId:       card.id,
      name:         card.name,
      condition:    card.condition,
      status:       "no_data",
      sampleCount:  0,
      outlierCount: 0,
      value:        null,
      changeRate:   null,
      confidence:   null,
    };
  }

  // Persist new IndexValue for this card
  await prisma.indexValue.create({
    data: {
      cardId:       result.cardId,
      value:        result.value,
      changeRate:   result.changeRate,
      sampleCount:  result.sampleCount,
      outlierCount: result.outlierCount,
      confidence:   result.confidence,
    },
  });

  return {
    cardId:       card.id,
    name:         card.name,
    condition:    card.condition,
    status:       "updated",
    sampleCount:  result.sampleCount,
    outlierCount: result.outlierCount,
    value:        result.value,
    changeRate:   result.changeRate,
    confidence:   result.confidence,
  };
}

// ----------------------------------------------------------------
// recalcIndex — global + per-card recalc
// Week 18: now also iterates all cards, computes per-card indices,
// and persists them. Per-card breakdown stored in RecalcLog.
// ----------------------------------------------------------------
export async function recalcIndex(
  triggeredBy: RecalcTrigger = "cron",
): Promise<RecalcResult> {
  const startedAt = Date.now();

  try {
    // ── 1. Stale detection ──────────────────────────────────────
    const stale = await markStalePrices();

    // ── 2. Global index ─────────────────────────────────────────
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

    // ── 3. Per-card recalc ──────────────────────────────────────
    const cards = await prisma.card.findMany({
      select: { id: true, name: true, condition: true },
      orderBy: { name: "asc" },
    });

    // 1カードの失敗が全体を止めないよう、各カードを独立した try/catch + リトライで処理。
    // バッチ処理 (CARD_CONCURRENCY 同時実行) で timeout リスクを軽減。
    async function processCard(card: { id: string; name: string; condition: string }): Promise<CardRecalcEntry> {
      try {
        return await withRetry(async () => {
          const cardResult = await calculateCardIndex(card.id);

          if (!cardResult) {
            return {
              cardId:       card.id,
              name:         card.name,
              condition:    card.condition,
              status:       "no_data" as const,
              sampleCount:  0,
              outlierCount: 0,
              value:        null,
              changeRate:   null,
              confidence:   null,
            };
          }

          // Check if the value meaningfully changed before writing a new row
          const previous = await prisma.indexValue.findFirst({
            where:   { cardId: card.id },
            orderBy: { calculatedAt: "desc" },
            select:  { value: true },
          });

          const changed =
            !previous ||
            Math.abs((cardResult.value - previous.value) / Math.max(previous.value, 1)) > 0.001;

          if (changed) {
            await prisma.indexValue.create({
              data: {
                cardId:       card.id,
                value:        cardResult.value,
                changeRate:   cardResult.changeRate,
                sampleCount:  cardResult.sampleCount,
                outlierCount: cardResult.outlierCount,
                confidence:   cardResult.confidence,
              },
            });
            return {
              cardId:       card.id,
              name:         card.name,
              condition:    card.condition,
              status:       "updated" as const,
              sampleCount:  cardResult.sampleCount,
              outlierCount: cardResult.outlierCount,
              value:        cardResult.value,
              changeRate:   cardResult.changeRate,
              confidence:   cardResult.confidence,
            };
          }

          return {
            cardId:       card.id,
            name:         card.name,
            condition:    card.condition,
            status:       "skipped" as const,
            sampleCount:  cardResult.sampleCount,
            outlierCount: cardResult.outlierCount,
            value:        cardResult.value,
            changeRate:   cardResult.changeRate,
            confidence:   cardResult.confidence,
          };
        }, CARD_MAX_RETRIES);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[recalcIndex] card ${card.id} (${card.name}) failed after retries:`, message);
        return {
          cardId:       card.id,
          name:         card.name,
          condition:    card.condition,
          status:       "failed",
          sampleCount:  0,
          outlierCount: 0,
          value:        null,
          changeRate:   null,
          confidence:   null,
          error:        message,
        };
      }
    }

    const cardEntries = await runInBatches(cards, CARD_CONCURRENCY, processCard);

    const cardSummary: CardRecalcSummary = {
      processed: cardEntries.length,
      updated:   cardEntries.filter((e) => e.status === "updated").length,
      skipped:   cardEntries.filter((e) => e.status === "skipped").length,
      noData:    cardEntries.filter((e) => e.status === "no_data").length,
      failed:    cardEntries.filter((e) => e.status === "failed").length,
      entries:   cardEntries,
    };

    // ── 4. Persist global IndexValue ────────────────────────────
    const stored = await prisma.indexValue.create({
      data: {
        cardId:       null,
        value:        result.value,
        changeRate:   result.changeRate,
        sampleCount:  result.sampleCount,
        outlierCount: result.outlierCount,
        confidence:   result.confidence,
      },
    });

    // ── 5. RecalcLog ────────────────────────────────────────────
    await prisma.recalcLog.create({
      data: {
        status:          "success",
        triggeredBy,
        durationMs:      Date.now() - startedAt,
        indexValueId:    stored.id,
        value:           stored.value,
        changeRate:      stored.changeRate,
        sampleCount:     result.sampleCount,
        outlierCount:    result.outlierCount,
        staleFlagged:    stale.flagged,
        staleUnflagged:  stale.unflagged,
        cardsProcessed:  cardSummary.processed,
        cardsUpdated:    cardSummary.updated,
        cardsSkipped:    cardSummary.skipped,
        cardsFailed:     cardSummary.failed,
        // Store only top-level entry data (truncate to 100 for log size)
        cardBreakdown:   cardSummary.entries.slice(0, 100).map((e) => ({
          cardId:      e.cardId,
          name:        e.name,
          condition:   e.condition,
          status:      e.status,
          sampleCount: e.sampleCount,
          value:       e.value,
          confidence:  e.confidence,
          ...(e.error ? { error: e.error } : {}),
        })),
        // 失敗カードのみ抜粋（デバッグ用途、最大30件）
        ...(cardSummary.failed > 0
          ? {
              failedBreakdown: cardSummary.entries
                .filter((e) => e.status === "failed")
                .slice(0, 30)
                .map((e) => ({ cardId: e.cardId, name: e.name, error: e.error })),
            }
          : {}),
      },
    });

    const finalResult: RecalcResult = {
      saved:        true,
      id:           stored.id,
      value:        stored.value,
      changeRate:   stored.changeRate,
      sampleCount:  result.sampleCount,
      outlierCount: result.outlierCount,
      confidence:   result.confidence,
      stale,
      cards:        cardSummary,
    };

    // ── 6. Discord alerts (fire-and-forget) ─────────────────────
    // Non-blocking — errors are caught inside each helper
    void postMarketAlerts(cardSummary).catch(() => undefined);
    void postCollectorLog(finalResult).catch(() => undefined);

    return finalResult;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.recalcLog.create({
      data: {
        status:      "error",
        triggeredBy,
        durationMs:  Date.now() - startedAt,
        errorMessage,
      },
    });
    throw err;
  }
}
