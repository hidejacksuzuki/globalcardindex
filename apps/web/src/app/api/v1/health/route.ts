/**
 * GET /api/v1/health
 *
 * Public health check — no auth required.
 * Designed for external uptime monitors (UptimeRobot, Better Uptime, Checkly, etc.)
 *
 * Returns HTTP 200 when healthy, HTTP 503 when degraded.
 *
 * Response shape:
 * {
 *   ok:        boolean,         // false = at least one check failed
 *   version:   string,          // NEXT_PUBLIC_APP_VERSION or "unknown"
 *   checks: {
 *     db:      { ok: boolean, latencyMs: number, error?: string },
 *     index:   { ok: boolean, latencyMs: number, ageMin?: number, error?: string },
 *   },
 *   uptimeMs:  number           // process.uptime() * 1000
 * }
 *
 * Uptime monitor config (example — UptimeRobot):
 *   URL:             https://www.gci-index.com/api/v1/health
 *   Type:            HTTP(s)
 *   Keyword:         "ok":true
 *   Interval:        5 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { strictLimiter, getClientIp, rateLimitResponse } from "@gci/core";
import { prisma }          from "@gci/db";

export const dynamic = "force-dynamic";

// IndexValue freshness threshold — alert if latest entry is older than this
const INDEX_STALE_MINUTES = 120; // 2 hours

type CheckResult = {
  ok:        boolean;
  latencyMs: number;
  error?:    string;
  ageMin?:   number;   // only for index check
};

async function checkDb(): Promise<CheckResult> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    return {
      ok:        false,
      latencyMs: Date.now() - t,
      error:     err instanceof Error ? err.message : "unknown db error",
    };
  }
}

async function checkIndex(): Promise<CheckResult> {
  const t = Date.now();
  try {
    const latest = await prisma.indexValue.findFirst({
      where:   { cardId: null },
      orderBy: { calculatedAt: "desc" },
      select:  { calculatedAt: true, value: true },
    });

    if (!latest) {
      return { ok: false, latencyMs: Date.now() - t, error: "no index values found" };
    }

    // Calculate age in minutes since last global recalc
    const latestDate  = latest.calculatedAt;
    const nowUtc      = new Date();
    const ageMs       = nowUtc.getTime() - latestDate.getTime();
    const ageMin      = Math.round(ageMs / 60_000);
    const isStale     = ageMin > INDEX_STALE_MINUTES;

    return {
      ok:        !isStale,
      latencyMs: Date.now() - t,
      ageMin,
      ...(isStale ? { error: `index stale: ${ageMin} min old (threshold: ${INDEX_STALE_MINUTES})` } : {}),
    };
  } catch (err) {
    return {
      ok:        false,
      latencyMs: Date.now() - t,
      error:     err instanceof Error ? err.message : "unknown index error",
    };
  }
}

export async function GET(req: NextRequest) {
  // ── Rate limiting ───────────────────────────────────────────────────────
  const _rl = strictLimiter.check(getClientIp(req.headers));
  if (!_rl.allowed) return rateLimitResponse(_rl, strictLimiter.max);

  const [db, index] = await Promise.all([checkDb(), checkIndex()]);

  const ok = db.ok && index.ok;

  return NextResponse.json(
    {
      ok,
      version:  process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      checks:   { db, index },
      uptimeMs: Math.round(process.uptime() * 1000),
    },
    { status: ok ? 200 : 503 },
  );
}
