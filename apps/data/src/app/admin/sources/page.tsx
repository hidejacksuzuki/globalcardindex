import { getSourceStats, getSourceTrends, type SourceStat, type SourceTrend } from "@gci/core";
import { formatDateTime } from "@gci/core";

export const dynamic = "force-dynamic";

export default async function AdminSourcesPage() {
  const [sources, trends] = await Promise.all([
    getSourceStats(),
    getSourceTrends(),
  ]);

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Sources</h1>
        <p className="mt-1 text-sm text-navy/50">
          ソース別の信頼性・ノイズ率・採用率を確認します。
        </p>
      </header>

      {sources.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          No source data yet.
        </p>
      ) : (
        <>
          {/* ── ソース特性カード ── */}
          <section>
            <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
              Source overview
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((s) => (
                <SourceCard key={s.sourceName} stat={s} />
              ))}
            </div>
          </section>

          {/* ── 詳細テーブル ── */}
          <section>
            <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
              Detail table
            </h2>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Active</th>
                    <th className="px-4 py-3 text-right">Stale</th>
                    <th className="px-4 py-3 text-right">Stale %</th>
                    <th className="px-4 py-3 text-right">Outlier</th>
                    <th className="px-4 py-3 text-right">Outlier %</th>
                    <th className="px-4 py-3 text-right">Low Trust</th>
                    <th className="px-4 py-3 text-right">Avg Trust</th>
                    <th className="px-4 py-3 text-right">Weight</th>
                    <th className="px-4 py-3">Last Fetched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {sources.map((s) => (
                    <tr key={s.sourceName} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 font-medium text-navy">{s.sourceName}</td>
                      <td className="px-4 py-3 text-navy/50">{s.sourceType ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gold-700">{s.active.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                        {s.stale > 0 ? s.stale.toLocaleString() : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <RateBar value={s.staleRate} color="amber" />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">
                        {s.outlier > 0 ? s.outlier.toLocaleString() : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <RateBar value={s.outlierRate} color="red" />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">
                        {s.lowTrust > 0 ? s.lowTrust.toLocaleString() : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <TrustBadge score={s.avgTrust} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                        {s.trustWeight.toFixed(2)}×
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/50 tabular-nums">
                        {s.lastCapturedAt ? formatDateTime(s.lastCapturedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Health Trend ── */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-widest text-navy/40">
              Health trend
            </h2>
            <p className="mb-4 text-[11px] text-navy/40">
              capturedAt ベースの件数推移。24h が 0 の場合は fetch 停止の可能性あり。
            </p>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">24 h</th>
                    <th className="px-4 py-3 text-right">Stale%</th>
                    <th className="px-4 py-3 text-right">Outlier%</th>
                    <th className="px-4 py-3 text-right">7 d</th>
                    <th className="px-4 py-3 text-right">Stale%</th>
                    <th className="px-4 py-3 text-right">Outlier%</th>
                    <th className="px-4 py-3 text-right">30 d</th>
                    <th className="px-4 py-3">Last Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {trends.map((t) => (
                    <tr key={t.sourceName} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 font-medium text-navy">{t.sourceName}</td>
                      <td className="px-4 py-3"><HealthBadge status={t.status} /></td>
                      {/* 24h */}
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${
                        t.h24.count === 0 ? "text-red-500" : "text-navy"
                      }`}>
                        {t.h24.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[11px] text-amber-600">
                        {t.h24.count > 0 ? `${t.h24.staleRate.toFixed(1)}%` : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[11px] text-red-600">
                        {t.h24.count > 0 ? `${t.h24.outlierRate.toFixed(1)}%` : <span className="text-navy/25">—</span>}
                      </td>
                      {/* 7d */}
                      <td className={`px-4 py-3 text-right tabular-nums ${
                        t.d7.count === 0 ? "text-red-400" : "text-navy/70"
                      }`}>
                        {t.d7.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[11px] text-amber-600">
                        {t.d7.count > 0 ? `${t.d7.staleRate.toFixed(1)}%` : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[11px] text-red-600">
                        {t.d7.count > 0 ? `${t.d7.outlierRate.toFixed(1)}%` : <span className="text-navy/25">—</span>}
                      </td>
                      {/* 30d */}
                      <td className="px-4 py-3 text-right tabular-nums text-navy/50">
                        {t.d30.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/40 tabular-nums">
                        {t.lastCapturedAt ? formatDateTime(t.lastCapturedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 解釈ガイド ── */}
          <section className="border border-navy/10 bg-navy/[0.02] p-6">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
              How to read this
            </h2>
            <div className="space-y-2 text-sm text-navy/60">
              <p>
                <span className="font-medium text-navy">Stale %</span> が高い →
                そのソースの fetch が止まっている可能性あり。cron ログを確認。
              </p>
              <p>
                <span className="font-medium text-navy">Outlier %</span> が高い →
                相場から外れた価格が多い（スパム出品・誤記・限定品混入など）。
                trustWeight を下げることで指数への影響を抑制できる。
              </p>
              <p>
                <span className="font-medium text-navy">Avg Trust</span> が低い →
                ソースの defaultTrustScore または trustWeight の見直しを検討。
                Source テーブルを直接 UPDATE して変更後に recalc を実行。
              </p>
              <p>
                <span className="font-medium text-navy">Weight</span> ×
                平均 Trust が実質的な指数への影響力を決める。
                量が多くてもノイズ率が高いソースは Weight を 0.5 などに下げると安定する。
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

function SourceCard({ stat }: { stat: SourceStat }) {
  const noiseRate = stat.total > 0
    ? (((stat.stale + stat.outlier + stat.lowTrust) / stat.total) * 100)
    : 0;

  const quality =
    stat.avgTrust >= 70 && noiseRate < 10 ? "high"
    : stat.avgTrust >= 40 && noiseRate < 30 ? "mid"
    : "low";

  const qualityStyles = {
    high: "border-gold-300 bg-gold-50",
    mid:  "border-navy/10 bg-white",
    low:  "border-red-200 bg-red-50/40",
  };

  return (
    <div className={`border p-5 ${qualityStyles[quality]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-navy">{stat.sourceName}</p>
          <p className="text-xs text-navy/40">{stat.sourceType ?? "unknown type"}</p>
        </div>
        <QualityTag quality={quality} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Metric label="Total"   value={stat.total.toLocaleString()} />
        <Metric label="Active"  value={stat.active.toLocaleString()} highlight="green" />
        <Metric label="Avg Trust" value={stat.avgTrust.toString()} highlight={
          stat.avgTrust >= 70 ? "green" : stat.avgTrust >= 40 ? "neutral" : "red"
        } />
      </div>

      {/* ノイズバー */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-navy/40">
          <span>Noise rate</span>
          <span>{noiseRate.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
          <div
            className={`h-full rounded-full transition-all ${
              noiseRate > 30 ? "bg-red-400" : noiseRate > 10 ? "bg-amber-400" : "bg-gold-500"
            }`}
            style={{ width: `${Math.min(noiseRate, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-navy/40">
        <span>Weight: <span className="font-medium text-navy/70">{stat.trustWeight.toFixed(2)}×</span></span>
        <span>
          {stat.lastCapturedAt
            ? `fetched ${new Date(stat.lastCapturedAt).toLocaleDateString("ja-JP")}`
            : "never fetched"}
        </span>
      </div>
    </div>
  );
}

function QualityTag({ quality }: { quality: "high" | "mid" | "low" }) {
  const styles = {
    high: "bg-gold-100 text-gold-700",
    mid:  "bg-navy/5 text-navy/50",
    low:  "bg-red-100 text-red-600",
  };
  const labels = { high: "High quality", mid: "Moderate", low: "Noisy" };
  return (
    <span className={`rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-widest ${styles[quality]}`}>
      {labels[quality]}
    </span>
  );
}

function Metric({
  label,
  value,
  highlight = "neutral",
}: {
  label:      string;
  value:      string;
  highlight?: "green" | "red" | "neutral";
}) {
  const colors = { green: "text-gold-700", red: "text-red-600", neutral: "text-navy" };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${colors[highlight]}`}>{value}</p>
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-gold-700"
    : score >= 40 ? "text-navy/60"
    : "text-red-600";
  return <span className={`tabular-nums ${color}`}>{score}</span>;
}

function RateBar({ value, color }: { value: number; color: "amber" | "red" }) {
  const barColor = color === "red" ? "bg-red-400" : "bg-amber-400";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy/10">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-10 text-right text-navy/50">{value.toFixed(1)}%</span>
    </div>
  );
}

function HealthBadge({ status }: { status: SourceTrend["status"] }) {
  const styles = {
    healthy:  "bg-gold-100 text-gold-700",
    degraded: "bg-amber-100 text-amber-700",
    dead:     "bg-red-100 text-red-700",
  };
  const labels = {
    healthy:  "● Healthy",
    degraded: "▲ Degraded",
    dead:     "✕ Dead",
  };
  return (
    <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-widest font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
