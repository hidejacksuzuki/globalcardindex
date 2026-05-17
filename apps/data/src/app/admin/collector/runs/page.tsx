/**
 * /admin/collector/runs
 *
 * CollectorRun log page.
 * Shows recent collector sessions with status breakdowns and filter reasons.
 */

import Link       from "next/link";
import { prisma } from "@gci/db";

export const dynamic = "force-dynamic";

// ── Data ──────────────────────────────────────────────────────────────────────

async function getRunData() {
  // Session-level aggregation: group by sessionId, get counts
  const sessions = await prisma.collectorRun.groupBy({
    by:      ["sessionId", "source"],
    _count:  { id: true },
    orderBy: { sessionId: "desc" },
    take:    50,
  });

  // Status breakdown per session
  const statusBreakdowns = await prisma.collectorRun.groupBy({
    by:      ["sessionId", "status"],
    _count:  { id: true },
    orderBy: { sessionId: "desc" },
  });

  // Recent individual runs (last 200) for filter reason analysis
  const recent = await prisma.collectorRun.findMany({
    orderBy: { createdAt: "desc" },
    take:    200,
    select: {
      id:             true,
      sessionId:      true,
      source:         true,
      cardName:       true,
      status:         true,
      rawTitle:       true,
      rawPrice:       true,
      normalizedTitle:true,
      filterReason:   true,
      importedAt:     true,
      createdAt:      true,
    },
  });

  // Top filter reasons
  const filterReasonCounts = new Map<string, number>();
  for (const run of recent) {
    if (run.filterReason) {
      const key = run.filterReason.split(":")[0].trim();
      filterReasonCounts.set(key, (filterReasonCounts.get(key) ?? 0) + 1);
    }
  }
  const topReasons = [...filterReasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Overall stats
  const totalCount    = recent.length;
  const importedCount = recent.filter((r) => r.status === "imported").length;
  const filteredCount = recent.filter((r) => r.status === "filtered").length;
  const errorCount    = recent.filter((r) => r.status === "error").length;

  // Build session summary map
  const sessionStatusMap = new Map<string, Record<string, number>>();
  for (const s of statusBreakdowns) {
    const map = sessionStatusMap.get(s.sessionId) ?? {};
    map[s.status] = s._count.id;
    sessionStatusMap.set(s.sessionId, map);
  }

  return {
    sessions,
    recent,
    topReasons,
    sessionStatusMap,
    totals: { totalCount, importedCount, filteredCount, errorCount },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CollectorRunsPage() {
  const { sessions, recent, topReasons, sessionStatusMap, totals } =
    await getRunData();

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Collector</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Collector Runs</h1>
        <p className="mt-1 text-sm text-navy/50">
          収集セッションのログと除外フィルター分析。
        </p>
      </header>

      {/* Sub-nav */}
      <CollectorSubNav active="runs" />

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white p-8 text-center text-sm text-navy/40">
          まだ収集ログがありません。
          <Link href="/admin/collector/import" className="ml-1 text-navy underline underline-offset-2">
            Import
          </Link>
          {" "}ページから最初の収集を実行してください。
        </div>
      ) : (
        <>
          {/* ── Summary stats ──────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Items"   value={totals.totalCount}    color="border-navy/10" />
            <StatCard label="Imported"      value={totals.importedCount} color="border-green-200" highlight="text-green-700" />
            <StatCard label="Filtered"      value={totals.filteredCount} color="border-amber-200" highlight="text-amber-700" />
            <StatCard label="Errors"        value={totals.errorCount}    color="border-red-200"   highlight="text-red-700" />
          </section>

          {/* ── Top filter reasons ─────────────────────────────────────────── */}
          {topReasons.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
                Top Filter Reasons
              </h2>
              <div className="overflow-x-auto border border-navy/10 bg-white">
                <table className="min-w-full divide-y divide-navy/10 text-sm">
                  <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                    <tr>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Count</th>
                      <th className="px-4 py-3">Bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/5">
                    {topReasons.map(([reason, count]) => {
                      const pct = totals.filteredCount > 0 ? (count / totals.filteredCount) * 100 : 0;
                      return (
                        <tr key={reason} className="hover:bg-navy/[0.02]">
                          <td className="px-4 py-2.5 font-mono text-xs text-navy/70">{reason}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-navy">{count}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-32 overflow-hidden rounded-full bg-navy/10">
                                <div
                                  className="h-full rounded-full bg-amber-400"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-navy/40">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Session log ────────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
              Sessions (last {sessions.length})
            </h2>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Session ID</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Imported</th>
                    <th className="px-4 py-3 text-right">Filtered</th>
                    <th className="px-4 py-3 text-right">Error</th>
                    <th className="px-4 py-3 text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {sessions.map((s) => {
                    const breakdown = sessionStatusMap.get(s.sessionId) ?? {};
                    const total     = s._count.id;
                    const imported  = breakdown["imported"]  ?? 0;
                    const filtered  = breakdown["filtered"]  ?? 0;
                    const error     = breakdown["error"]     ?? 0;
                    const passRate  = total > 0 ? ((imported / total) * 100).toFixed(0) : "—";
                    return (
                      <tr key={s.sessionId} className="hover:bg-navy/[0.02]">
                        <td className="px-4 py-3 font-mono text-[11px] text-navy/50">
                          {s.sessionId.slice(0, 16)}…
                        </td>
                        <td className="px-4 py-3 text-navy/60">{s.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy">{total}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-700">{imported || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600">{filtered || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-600">{error    || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy/60">{passRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Recent items ───────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
              Recent Items (last {recent.length})
            </h2>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-xs">
                <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Card Name</th>
                    <th className="px-3 py-2">Raw Title</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2">Filter Reason</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {recent.map((run) => (
                    <tr
                      key={run.id}
                      className={run.status === "imported" ? "" : "opacity-60"}
                    >
                      <td className="px-3 py-2">
                        <StatusDot status={run.status} />
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-medium text-navy">
                        {run.cardName ?? "—"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-navy/60">
                        {run.rawTitle ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                        {run.rawPrice != null ? `¥${run.rawPrice.toLocaleString()}` : "—"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-amber-600">
                        {run.filterReason ?? ""}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-navy/40 tabular-nums">
                        {run.createdAt.toLocaleDateString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollectorSubNav({ active }: { active: "urls" | "import" | "review" | "runs" }) {
  const items = [
    { href: "/admin/collector",        label: "URL Preview", key: "urls"   },
    { href: "/admin/collector/import", label: "Import",      key: "import" },
    { href: "/admin/collector/review", label: "Review",      key: "review" },
    { href: "/admin/collector/runs",   label: "Runs",        key: "runs"   },
  ];
  return (
    <div className="flex gap-1 border-b border-navy/10">
      {items.map(({ href, label, key }) => (
        <Link
          key={key}
          href={href}
          className={[
            "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
            active === key
              ? "border-navy text-navy font-medium"
              : "border-transparent text-navy/40 hover:text-navy/60",
          ].join(" ")}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({
  label, value, color, highlight = "text-navy",
}: {
  label:      string;
  value:      number;
  color:      string;
  highlight?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 bg-white ${color}`}>
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${highlight}`}>{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const styles: Record<string, string> = {
    imported: "bg-green-500",
    filtered: "bg-amber-400",
    error:    "bg-red-500",
    pending:  "bg-navy/30",
  };
  const labels: Record<string, string> = {
    imported: "imported",
    filtered: "filtered",
    error:    "error",
    pending:  "pending",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${styles[status] ?? "bg-navy/20"}`} />
      <span className="text-[10px] uppercase tracking-wide text-navy/50">
        {labels[status] ?? status}
      </span>
    </span>
  );
}
