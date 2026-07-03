import { prisma }  from "@gci/db";
import type { CronLog } from "@gci/db";

export const dynamic = "force-dynamic";

// ── Config ────────────────────────────────────────────────────────────────────

const CRON_LABELS: Record<string, string> = {
  "fetch":            "Price Fetch",
  "recalc":           "Index Recalc",
  "sync-cards":       "Card Sync",
  "daily-snapshot":   "Daily Snapshot",
  "daily-post":       "X Post",
  "daily-discord":    "Discord Post",
  "daily-newsletter": "Newsletter",
  "backup":           "DB Backup",
};

const STALE_LIMITS: Record<string, number> = {
  "fetch":            20,
  "recalc":           80,
  "sync-cards":       1500,
  "daily-snapshot":   1500,
  "daily-post":       1500,
  "daily-discord":    1500,
  "daily-newsletter": 1500,
  "backup":           1500,
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getCronData() {
  const names = Object.keys(CRON_LABELS);
  const now   = Date.now();

  const latestRuns = await prisma.cronLog.findMany({
    where:    { name: { in: names }, isDry: false },
    orderBy:  { createdAt: "desc" },
    distinct: ["name"],
    select:   { name: true, status: true, createdAt: true, durationMs: true, errorMessage: true },
  });

  const recentLogs = await prisma.cronLog.findMany({
    where:   { name: { in: names } },
    orderBy: { createdAt: "desc" },
    take:    50,
    select:  { id: true, name: true, status: true, isDry: true,
               createdAt: true, durationMs: true, errorMessage: true, triggeredBy: true, result: true },
  });

  const latestMap = Object.fromEntries(latestRuns.map((r) => [r.name, r]));

  const summaries = names.map((name) => {
    const run    = latestMap[name];
    const ageMs  = run ? now - run.createdAt.getTime() : null;
    const ageMin = ageMs !== null ? Math.round(ageMs / 60_000) : null;
    const limit  = STALE_LIMITS[name] ?? 1500;

    let health: "ok" | "stale" | "error" | "never_run";
    if (!run)                                    health = "never_run";
    else if (run.status === "error")             health = "error";
    else if (ageMin !== null && ageMin > limit)  health = "stale";
    else                                         health = "ok";

    return { name, run: run ?? null, ageMin, health };
  });

  return { summaries, recentLogs };
}

// ── Recalc detail: failure rate / stale card count / partial failures ─────────

async function getRecalcHealth() {
  const recentRecalcLogs = await prisma.recalcLog.findMany({
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  {
      id: true, status: true, durationMs: true, createdAt: true,
      cardsProcessed: true, cardsUpdated: true, cardsSkipped: true, cardsFailed: true,
      failedBreakdown: true, staleFlagged: true, errorMessage: true,
    },
  });

  const total        = recentRecalcLogs.length;
  const errorRuns     = recentRecalcLogs.filter((r) => r.status === "error").length;
  const failureRate   = total > 0 ? (errorRuns / total) * 100 : null;
  const avgDurationMs = total > 0
    ? recentRecalcLogs.reduce((s, r) => s + (r.durationMs ?? 0), 0) / total
    : null;
  const latest        = recentRecalcLogs[0] ?? null;
  const staleCardCount = latest?.staleFlagged ?? null;
  const totalCardsFailedRecent = recentRecalcLogs.reduce((s, r) => s + (r.cardsFailed ?? 0), 0);

  return { recentRecalcLogs, total, errorRuns, failureRate, avgDurationMs, staleCardCount, totalCardsFailedRecent };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAge(min: number | null): string {
  if (min === null) return "—";
  if (min < 60)     return `${min}m ago`;
  if (min < 1440)   return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(d: Date): string {
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
    hour12:   false,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: "ok" | "stale" | "error" | "never_run" }) {
  const map = {
    ok:        "bg-emerald-100 text-emerald-800",
    stale:     "bg-amber-100  text-amber-800",
    error:     "bg-red-100    text-red-800",
    never_run: "bg-slate-100  text-slate-500",
  };
  const labels = { ok: "OK", stale: "STALE", error: "ERROR", never_run: "NEVER RUN" };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[health]}`}>
      {labels[health]}
    </span>
  );
}

function CollectSummary({ name, result }: { name: string; result: unknown }) {
  if (name !== "fetch" || !result || typeof result !== "object") return <span className="text-navy/30">—</span>;
  const r = result as Record<string, unknown>;
  const c = r.collect as Record<string, number> | undefined;
  if (!c) return <span className="text-navy/30">—</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
      <span className="text-navy/60">{c.processed ?? 0}枚</span>
      <span className="text-emerald-700">+{c.saved ?? 0}件</span>
      {(c.autoApproved ?? 0) > 0 && (
        <span className="text-blue-600">✓{c.autoApproved}自動</span>
      )}
      {(c.skipped ?? 0) > 0 && (
        <span className="text-navy/30">skip{c.skipped}</span>
      )}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "ok")      return <span className="text-emerald-500">●</span>;
  if (status === "error")   return <span className="text-red-500">●</span>;
  if (status === "skipped") return <span className="text-slate-400">○</span>;
  return <span className="text-slate-400">·</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminLogsPage() {
  const { summaries, recentLogs } = await getCronData();
  const recalcHealth              = await getRecalcHealth();

  const errorCount = summaries.filter((s) => s.health === "error").length;
  const staleCount = summaries.filter((s) => s.health === "stale").length;
  const okCount    = summaries.filter((s) => s.health === "ok").length;

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Cron Logs</h1>
        <p className="mt-1 text-sm text-navy/50">
          各 cron エンドポイントの最終実行状況と直近ログを確認します。
        </p>
      </header>

      {/* ── Summary row ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Health Summary</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{okCount}</div>
            <div className="mt-0.5 text-xs text-emerald-600">Healthy</div>
          </div>
          <div className={`rounded-lg border p-4 text-center ${staleCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-2xl font-bold ${staleCount > 0 ? "text-amber-700" : "text-slate-400"}`}>{staleCount}</div>
            <div className={`mt-0.5 text-xs ${staleCount > 0 ? "text-amber-600" : "text-slate-400"}`}>Stale</div>
          </div>
          <div className={`rounded-lg border p-4 text-center ${errorCount > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-2xl font-bold ${errorCount > 0 ? "text-red-700" : "text-slate-400"}`}>{errorCount}</div>
            <div className={`mt-0.5 text-xs ${errorCount > 0 ? "text-red-600" : "text-slate-400"}`}>Errors</div>
          </div>
        </div>
      </section>

      {/* ── Recalc detail: failure rate / stale cards / partial failures ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Recalc Stability（直近{recalcHealth.total}回）
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className={`rounded-lg border p-4 text-center ${
            recalcHealth.failureRate !== null && recalcHealth.failureRate > 0
              ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
          }`}>
            <div className={`text-2xl font-bold ${
              recalcHealth.failureRate !== null && recalcHealth.failureRate > 0 ? "text-red-700" : "text-slate-400"
            }`}>
              {recalcHealth.failureRate !== null ? `${recalcHealth.failureRate.toFixed(1)}%` : "—"}
            </div>
            <div className="mt-0.5 text-xs text-navy/40">Failure Rate</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
            <div className="text-2xl font-bold text-slate-600">{fmtDuration(recalcHealth.avgDurationMs ?? null)}</div>
            <div className="mt-0.5 text-xs text-navy/40">Avg Duration</div>
          </div>
          <div className={`rounded-lg border p-4 text-center ${
            (recalcHealth.staleCardCount ?? 0) > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
          }`}>
            <div className={`text-2xl font-bold ${(recalcHealth.staleCardCount ?? 0) > 0 ? "text-amber-700" : "text-slate-400"}`}>
              {recalcHealth.staleCardCount ?? "—"}
            </div>
            <div className="mt-0.5 text-xs text-navy/40">Stale Cards（最新）</div>
          </div>
          <div className={`rounded-lg border p-4 text-center ${
            recalcHealth.totalCardsFailedRecent > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
          }`}>
            <div className={`text-2xl font-bold ${recalcHealth.totalCardsFailedRecent > 0 ? "text-red-700" : "text-slate-400"}`}>
              {recalcHealth.totalCardsFailedRecent}
            </div>
            <div className="mt-0.5 text-xs text-navy/40">Card 部分失敗（累計）</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-slate-50 text-left text-xs text-navy/40">
                <th className="px-4 py-3 font-medium">Time (JST)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Processed</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Skipped</th>
                <th className="px-4 py-3 font-medium">Failed</th>
                <th className="px-4 py-3 font-medium">Stale</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {recalcHealth.recentRecalcLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-navy/30">
                    まだ recalc ログがありません。
                  </td>
                </tr>
              ) : (
                recalcHealth.recentRecalcLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-navy/5 text-xs ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${
                      log.status === "error" || (log.cardsFailed ?? 0) > 0 ? "bg-red-50/20" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-navy/60 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1">
                        <StatusDot status={log.status} />
                        <span className={log.status === "error" ? "text-red-700 font-medium" : "text-navy/60"}>
                          {log.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-navy/60">{fmtDuration(log.durationMs)}</td>
                    <td className="px-4 py-2.5 text-navy/60 tabular-nums">{log.cardsProcessed ?? "—"}</td>
                    <td className="px-4 py-2.5 text-navy/60 tabular-nums">{log.cardsUpdated ?? "—"}</td>
                    <td className="px-4 py-2.5 text-navy/60 tabular-nums">{log.cardsSkipped ?? "—"}</td>
                    <td className={`px-4 py-2.5 tabular-nums ${(log.cardsFailed ?? 0) > 0 ? "text-red-600 font-semibold" : "text-navy/60"}`}>
                      {log.cardsFailed ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-navy/60 tabular-nums">{log.staleFlagged ?? "—"}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-red-600">{log.errorMessage ?? ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Per-cron status table ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Cron Status</h2>
        <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-slate-50 text-left text-xs text-navy/40">
                <th className="px-4 py-3 font-medium">Cron</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Last Run (JST)</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ name, run, ageMin, health }, i) => (
                <tr
                  key={name}
                  className={`border-b border-navy/5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${health === "error" ? "bg-red-50/30" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy">{CRON_LABELS[name] ?? name}</div>
                    <div className="text-[11px] text-navy/40">{name}</div>
                  </td>
                  <td className="px-4 py-3"><HealthBadge health={health} /></td>
                  <td className="px-4 py-3 text-navy/60 whitespace-nowrap">
                    {run ? fmtDate(run.createdAt) : <span className="text-navy/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-navy/60">{fmtAge(ageMin)}</td>
                  <td className="px-4 py-3 text-navy/60">{fmtDuration(run?.durationMs)}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-red-600">
                    {run?.errorMessage ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Recent activity feed ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Recent Activity — last 50 runs
        </h2>
        <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-slate-50 text-left text-xs text-navy/40">
                <th className="px-4 py-3 font-medium">Time (JST)</th>
                <th className="px-4 py-3 font-medium">Cron</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">収集結果</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-navy/30">
                    まだログがありません。cron エンドポイントを実行してください。
                  </td>
                </tr>
              ) : (
                recentLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-navy/5 text-xs ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} ${log.status === "error" ? "bg-red-50/20" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-navy/60 whitespace-nowrap">
                      {fmtDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-navy">
                      {CRON_LABELS[log.name] ?? log.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1">
                        <StatusDot status={log.status} />
                        <span className={log.status === "error" ? "text-red-700 font-medium" : "text-navy/60"}>
                          {log.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-navy/40">
                      {log.isDry
                        ? <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">dry</span>
                        : "live"}
                    </td>
                    <td className="px-4 py-2.5 text-navy/60">{fmtDuration(log.durationMs)}</td>
                    <td className="px-4 py-2.5">
                      <CollectSummary name={log.name} result={log.result} />
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-red-600">
                      {log.errorMessage ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
