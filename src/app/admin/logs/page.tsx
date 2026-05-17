import { getRecalcLogs, type RecalcLogEntry } from "@/actions/admin";
import { formatDateTime } from "@/lib/utils/formatDate";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const logs = await getRecalcLogs(50);

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount   = logs.filter((l) => l.status === "error").length;
  const noDataCount  = logs.filter((l) => l.status === "no_data").length;

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Recalc Logs</h1>
        <p className="mt-1 text-sm text-navy/50">
          recalcIndex の実行履歴。cron 障害・計算異常の追跡に使います。
        </p>
      </header>

      {/* ── サマリー ── */}
      {logs.length > 0 && (
        <section>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Total runs"  value={logs.length.toString()} />
            <StatCard label="Success"     value={successCount.toString()} highlight="green" />
            <StatCard label="No data"     value={noDataCount.toString()}  highlight="amber" />
            <StatCard label="Error"       value={errorCount.toString()}   highlight={errorCount > 0 ? "red" : "neutral"} />
            {logs[0] && (
              <StatCard
                label="Last run"
                value={relativeTime(logs[0].createdAt)}
                highlight="neutral"
              />
            )}
            {logs[0]?.status === "success" && logs[0].value !== null && (
              <StatCard
                label="Last value"
                value={logs[0].value.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}
                highlight="neutral"
              />
            )}
          </div>
        </section>
      )}

      {/* ── ログテーブル ── */}
      {logs.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          ログがありません。
          <code className="ml-1 text-xs">POST /api/v1/cron/recalc</code> を実行してください。
        </p>
      ) : (
        <section>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-right">Index value</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3 text-right">Samples</th>
                  <th className="px-4 py-3 text-right">Outliers</th>
                  <th className="px-4 py-3 text-right">Stale ▲/▼</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-navy/30">
            直近 50 件を表示。
          </p>
        </section>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

function LogRow({ log }: { log: RecalcLogEntry }) {
  const isError   = log.status === "error";
  const isNoData  = log.status === "no_data";
  const rowBg     = isError ? "bg-red-50/60" : isNoData ? "bg-amber-50/40" : "";

  return (
    <tr className={`hover:bg-navy/[0.02] ${rowBg}`}>
      <td className="px-4 py-3 text-xs tabular-nums text-navy/70 whitespace-nowrap">
        {formatDateTime(log.createdAt)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={log.status} />
      </td>
      <td className="px-4 py-3">
        <TriggerBadge trigger={log.triggeredBy} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
        {log.durationMs !== null ? `${log.durationMs.toLocaleString()} ms` : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-navy">
        {log.value !== null
          ? log.value.toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {log.changeRate !== null ? <ChangeRate rate={log.changeRate} /> : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
        {log.sampleCount ?? <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {log.outlierCount !== null
          ? <span className={log.outlierCount > 0 ? "text-red-500" : "text-navy/25"}>
              {log.outlierCount}
            </span>
          : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-navy/50">
        {log.staleFlagged !== null
          ? `▲${log.staleFlagged} ▼${log.staleUnflagged ?? 0}`
          : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 max-w-xs">
        {log.errorMessage
          ? <span className="font-mono text-[10px] text-red-600 break-all">{log.errorMessage}</span>
          : <span className="text-navy/25">—</span>}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: RecalcLogEntry["status"] }) {
  const styles = {
    success: "bg-gold-100 text-gold-700",
    no_data: "bg-amber-50 text-amber-600",
    error:   "bg-red-100 text-red-700",
  };
  const labels = {
    success: "✓ success",
    no_data: "○ no data",
    error:   "✕ error",
  };
  return (
    <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const isCron = trigger === "cron";
  return (
    <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-widest ${
      isCron ? "bg-navy/5 text-navy/40" : "bg-sky-50 text-sky-600"
    }`}>
      {isCron ? "cron" : "manual"}
    </span>
  );
}

function ChangeRate({ rate }: { rate: number }) {
  const color = rate > 0 ? "text-gold-700" : rate < 0 ? "text-red-600" : "text-navy/40";
  const prefix = rate > 0 ? "▲" : rate < 0 ? "▼" : "";
  return (
    <span className={`tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(2)}%
    </span>
  );
}

type Highlight = "green" | "amber" | "red" | "neutral";
function StatCard({ label, value, highlight = "neutral" }: {
  label: string; value: string; highlight?: Highlight;
}) {
  const colors: Record<Highlight, string> = {
    green: "text-gold-700", amber: "text-amber-600",
    red: "text-red-600",   neutral: "text-navy",
  };
  return (
    <div className="border border-navy/10 bg-white p-4">
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${colors[highlight]}`}>{value}</p>
    </div>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
