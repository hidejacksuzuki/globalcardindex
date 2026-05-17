/**
 * GET /api/v1/cron/health
 *
 * Internal cron health check — requires CRON_SECRET auth.
 * Reads CronLog to determine if each cron is running on schedule.
 * Sends a Discord alert if any cron is overdue.
 *
 * Schedule (vercel.json): every 30 min
 *
 * Query params:
 *   ?dry=1     → check only, don't send Discord alert
 *   ?force=1   → send Discord alert even if everything is ok (testing)
 *
 * Response:
 * {
 *   ok:       boolean,
 *   checks:   CronCheck[],
 *   alerted:  boolean,
 *   alertMsg: string | null,
 * }
 *
 * Manual verification:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        "https://gci-data.com/api/v1/cron/health?dry=1"
 */

import { NextRequest, NextResponse } from "next/server";
import { authorizeCron }             from "@gci/core";
import { prisma }                    from "@gci/db";

export const dynamic = "force-dynamic";

// ── Expected run intervals per cron ──────────────────────────────────────────
// staleLimitMin = how many minutes since last run before we consider it "stale"
// The values are intentionally generous (cron interval × 1.5 + buffer)
const CRON_SCHEDULE: Array<{
  name:          string;
  staleLimitMin: number;
  label:         string;
}> = [
  { name: "fetch",             staleLimitMin:  20,   label: "Price Fetch (*/10 min)"     },
  { name: "recalc",            staleLimitMin:  80,   label: "Index Recalc (hourly)"      },
  { name: "daily-snapshot",    staleLimitMin: 1500,  label: "Daily Snapshot (00:00 UTC)" },
  { name: "daily-post",        staleLimitMin: 1500,  label: "X Post (01:00 UTC)"         },
  { name: "daily-discord",     staleLimitMin: 1500,  label: "Discord Post (02:00 UTC)"   },
  { name: "daily-newsletter",  staleLimitMin: 1500,  label: "Newsletter (01:00 UTC)"     },
  { name: "backup",            staleLimitMin: 1500,  label: "DB Backup (03:00 UTC)"      },
];

type CronCheck = {
  name:        string;
  label:       string;
  status:      "ok" | "stale" | "error" | "never_run";
  lastRunAt:   string | null;   // ISO string
  ageMin:      number | null;   // minutes since last run
  lastStatus:  string | null;   // "ok" | "error" | "skipped"
  staleLimitMin: number;
};

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authError = authorizeCron(req);
  if (authError) return authError;

  const sp      = new URL(req.url).searchParams;
  const isDry   = sp.get("dry")   === "1";
  const isForce = sp.get("force") === "1";
  const now     = Date.now();

  // ── 1. Fetch most recent CronLog entry per cron name ─────────────────────
  const latestLogs = await prisma.cronLog.findMany({
    where: {
      name: { in: CRON_SCHEDULE.map((c) => c.name) },
      // Ignore dry-run entries for staleness calculation
      isDry: false,
    },
    orderBy: { createdAt: "desc" },
    distinct: ["name"],
    select: { name: true, status: true, createdAt: true },
  });

  const logMap = Object.fromEntries(
    latestLogs.map((l) => [l.name, l])
  );

  // ── 2. Evaluate staleness ─────────────────────────────────────────────────
  const checks: CronCheck[] = CRON_SCHEDULE.map((sched) => {
    const log       = logMap[sched.name];
    const lastRunAt = log?.createdAt ?? null;
    const ageMin    = lastRunAt
      ? Math.round((now - lastRunAt.getTime()) / 60_000)
      : null;

    let status: CronCheck["status"];
    if (!log)                                 status = "never_run";
    else if (log.status === "error")          status = "error";
    else if (ageMin !== null && ageMin > sched.staleLimitMin) status = "stale";
    else                                      status = "ok";

    return {
      name:          sched.name,
      label:         sched.label,
      status,
      lastRunAt:     lastRunAt?.toISOString() ?? null,
      ageMin,
      lastStatus:    log?.status ?? null,
      staleLimitMin: sched.staleLimitMin,
    };
  });

  const problematic = checks.filter((c) => c.status !== "ok");
  const allOk       = problematic.length === 0;

  // ── 3. Discord alert ──────────────────────────────────────────────────────
  let alerted  = false;
  let alertMsg: string | null = null;

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const shouldAlert = !isDry && webhookUrl && (!allOk || isForce);

  if (shouldAlert) {
    const lines = isForce && allOk
      ? ["✅ All crons healthy (forced alert test)"]
      : problematic.map((c) => {
          const age = c.ageMin !== null ? `${c.ageMin} min ago` : "never";
          const icon =
            c.status === "never_run" ? "⚠️" :
            c.status === "error"     ? "🔴" : "🟡";
          return `${icon} **${c.label}**: ${c.status} (last run: ${age})`;
        });

    const embed = {
      title:       allOk ? "✅ GCI Cron Health — OK" : "🚨 GCI Cron Health Alert",
      description: lines.join("\n"),
      color:       allOk ? 0x57f287 : (problematic.some((c) => c.status === "error") ? 0xed4245 : 0xfee75c),
      timestamp:   new Date().toISOString(),
      footer:      { text: "gci-data.com · /api/v1/cron/health" },
    };

    try {
      const res = await fetch(webhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ embeds: [embed] }),
      });

      if (res.ok) {
        alerted  = true;
        alertMsg = lines.join(" | ");
      } else {
        console.error("[cron/health] Discord webhook failed:", res.status, await res.text());
      }
    } catch (err) {
      console.error("[cron/health] Discord webhook error:", err);
    }
  }

  // ── 4. Response ───────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok:       allOk,
      checks,
      alerted,
      alertMsg,
      checkedAt: new Date().toISOString(),
    },
    { status: allOk ? 200 : 207 },
  );
}
