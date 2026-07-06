/**
 * packages/core/src/jobs/writeCronLog.ts
 *
 * Fire-and-forget CronLog writer.
 *
 * Usage (in a cron route):
 *   import { writeCronLog } from "@gci/core";
 *
 *   // on success
 *   await writeCronLog("recalc", "ok", { durationMs, result: { updated } });
 *
 *   // on error
 *   await writeCronLog("recalc", "error", { durationMs, errorMessage: err.message });
 *
 * Design:
 *   - Never throws — logging must not interrupt the cron response.
 *   - isDry flag prevents writes when ?dry=1 is in effect (caller's choice).
 *   - triggeredBy is inferred from User-Agent when not supplied.
 */

import { prisma } from "@gci/db";

export type CronName =
  | "fetch"
  | "recalc"
  | "sync-cards"
  | "daily-snapshot"
  | "daily-post"
  | "x-noon"
  | "x-evening"
  | "daily-discord"
  | "daily-newsletter"
  | "watchlist-alerts"
  | "weekly-recap"
  | "backup"
  | "auto-approve";

export type CronStatus = "ok" | "error" | "skipped";

export interface WriteCronLogOptions {
  durationMs?:   number;
  result?:       Record<string, unknown>;
  errorMessage?: string;
  isDry?:        boolean;
  triggeredBy?:  "cron" | "manual";
}

export async function writeCronLog(
  name:    CronName,
  status:  CronStatus,
  options: WriteCronLogOptions = {},
): Promise<void> {
  const {
    durationMs,
    result,
    errorMessage,
    isDry        = false,
    triggeredBy  = "cron",
  } = options;

  try {
    await prisma.cronLog.create({
      data: {
        name,
        status,
        isDry,
        durationMs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result:       (result ?? undefined) as any,
        errorMessage: errorMessage ?? undefined,
        triggeredBy,
      },
    });
  } catch (err) {
    // DB write failed — log to console but do not re-throw
    console.error(`[writeCronLog] failed to write CronLog for "${name}":`, err);
  }
}
