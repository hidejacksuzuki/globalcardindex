import {
  getPriceStats,
  getPriceList,
  type PriceListFilter,
  type PriceRow,
  type RejectionReason,
  TRUST_THRESHOLD,
} from "@/actions/admin";
import { formatDateTime } from "@/lib/utils/formatDate";
import { formatPrice }    from "@/lib/utils/formatPrice";

export const dynamic = "force-dynamic";

const FILTERS: { value: PriceListFilter; label: string }[] = [
  { value: "all",       label: "All"       },
  { value: "included",  label: "Included"  },
  { value: "excluded",  label: "Excluded"  },
  { value: "outlier",   label: "Outlier"   },
  { value: "stale",     label: "Stale"     },
  { value: "low_trust", label: "Low Trust" },
];

export default async function AdminPricesPage({
  searchParams,
}: {
  searchParams: { filter?: string; page?: string };
}) {
  const filter = (searchParams.filter ?? "all") as PriceListFilter;
  const page   = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const [stats, priceList] = await Promise.all([
    getPriceStats(),
    getPriceList({ filter, page, limit: 50 }),
  ]);

  const inactiveRate =
    stats.total > 0
      ? (((stats.stale + stats.outlier) / stats.total) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Price Debug</h1>
        <p className="mt-1 text-sm text-navy/50">
          指数採用・除外の内訳を確認するためのデバッグビューです。
        </p>
      </header>

      {/* ── サマリーカード ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total"         value={stats.total.toLocaleString()}                     />
          <StatCard label="Active"        value={stats.active.toLocaleString()}      highlight="green"  />
          <StatCard label="Stale"         value={stats.stale.toLocaleString()}       highlight="amber"  />
          <StatCard label="Outlier"       value={stats.outlier.toLocaleString()}     highlight="red"    />
          <StatCard label="Low Trust"     value={stats.lowTrust.toLocaleString()}    highlight="red"    />
          <StatCard
            label="Inactive rate"
            value={`${inactiveRate}%`}
            highlight={parseFloat(inactiveRate) > 20 ? "red" : "neutral"}
          />
        </div>
      </section>

      {/* ── 採用内訳バー ── */}
      {stats.total > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Adoption breakdown</h2>
          <div className="flex h-5 w-full overflow-hidden rounded-sm">
            <div
              className="bg-gold-500 transition-all"
              style={{ width: `${(stats.active / stats.total) * 100}%` }}
              title={`Active: ${stats.active}`}
            />
            <div
              className="bg-amber-300 transition-all"
              style={{ width: `${(stats.stale / stats.total) * 100}%` }}
              title={`Stale: ${stats.stale}`}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${(stats.outlier / stats.total) * 100}%` }}
              title={`Outlier: ${stats.outlier}`}
            />
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-navy/50">
            <span><span className="inline-block h-2 w-2 rounded-sm bg-gold-500 mr-1" />Active</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-300 mr-1" />Stale</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-red-400 mr-1" />Outlier</span>
          </div>
        </section>
      )}

      {/* ── Source 別テーブル ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">By source</h2>
        {stats.bySources.length === 0 ? (
          <EmptyState message="No price data yet." />
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Active</th>
                  <th className="px-4 py-3 text-right">Stale</th>
                  <th className="px-4 py-3 text-right">Outlier</th>
                  <th className="px-4 py-3 text-right">Avg Trust</th>
                  <th className="px-4 py-3 text-right">Weight</th>
                  <th className="px-4 py-3">Last Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {stats.bySources.map((s) => (
                  <tr key={s.sourceName} className="hover:bg-navy/[0.02]">
                    <td className="px-4 py-3 font-medium text-navy">{s.sourceName}</td>
                    <td className="px-4 py-3 text-navy/50">{s.sourceType ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gold-700">{s.active.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                      {s.stale > 0 ? s.stale.toLocaleString() : <span className="text-navy/25">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">
                      {s.outlier > 0 ? s.outlier.toLocaleString() : <span className="text-navy/25">—</span>}
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
        )}
      </section>

      {/* ── 価格明細テーブル ── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xs uppercase tracking-widest text-navy/40">Price detail</h2>
          <span className="text-[11px] text-navy/30">
            {priceList.total.toLocaleString()} rows · trust threshold ≥ {TRUST_THRESHOLD}
          </span>
        </div>

        {/* フィルタータブ */}
        <div className="mb-0 flex gap-1 border-b border-navy/10">
          {FILTERS.map((f) => (
            <a
              key={f.value}
              href={`?filter=${f.value}&page=1`}
              className={[
                "px-3 py-2 text-xs uppercase tracking-widest transition",
                filter === f.value
                  ? "border-b-2 border-navy text-navy -mb-px"
                  : "text-navy/40 hover:text-navy/70",
              ].join(" ")}
            >
              {f.label}
            </a>
          ))}
        </div>

        {priceList.rows.length === 0 ? (
          <EmptyState message="No prices match this filter." />
        ) : (
          <>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Set</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Trust</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3 text-right">Seller</th>
                    <th className="px-4 py-3">Included</th>
                    <th className="px-4 py-3">Rejection reason</th>
                    <th className="px-4 py-3">Fingerprint</th>
                    <th className="px-4 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {priceList.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 font-medium text-navy">{row.cardName}</td>
                      <td className="px-4 py-3 text-xs text-navy/50">{row.setName}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatPrice(row.price, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TrustBadge score={row.trustScore} />
                        <TrustBreakdownInline bd={row.trustBreakdown} />
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/60">{row.sourceName}</td>
                      <td className="px-4 py-3 text-xs text-navy/50">{row.listingType ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-navy/50">
                        {row.sellerScore !== null ? row.sellerScore.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <IncludedBadge included={row.includedInIndex} />
                      </td>
                      <td className="px-4 py-3">
                        <RejectionBadges reasons={row.rejectionReasons} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-navy/30">
                        {row.fingerprint ? `${row.fingerprint.slice(0, 12)}…` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/50 tabular-nums">
                        {formatDateTime(row.capturedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {priceList.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-navy/50">
                <span>
                  Page {priceList.page} / {priceList.totalPages}
                  &nbsp;·&nbsp;
                  {priceList.total.toLocaleString()} rows
                </span>
                <div className="flex gap-2">
                  {priceList.page > 1 && (
                    <a
                      href={`?filter=${filter}&page=${priceList.page - 1}`}
                      className="border border-navy/20 px-3 py-1 hover:border-navy/40"
                    >
                      ← Prev
                    </a>
                  )}
                  {priceList.page < priceList.totalPages && (
                    <a
                      href={`?filter=${filter}&page=${priceList.page + 1}`}
                      className="border border-navy/20 px-3 py-1 hover:border-navy/40"
                    >
                      Next →
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── 操作ガイド ── */}
      <section className="border border-navy/10 bg-navy/[0.02] p-6">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Next actions</h2>
        <div className="space-y-2 text-sm text-navy/70 font-mono">
          <p><span className="text-navy/40">1.</span> npm run prisma:migrate        <span className="text-navy/30 font-sans ml-2">— schema を DB に適用</span></p>
          <p><span className="text-navy/40">2.</span> npm run dev                   <span className="text-navy/30 font-sans ml-2">— 開発サーバー起動</span></p>
          <p><span className="text-navy/40">3.</span> npm run import-csv            <span className="text-navy/30 font-sans ml-2">— seed / テストデータ投入</span></p>
          <p><span className="text-navy/40">4.</span> curl -X POST /api/v1/cron/recalc  <span className="text-navy/30 font-sans ml-2">— 指数を手動再計算</span></p>
          <p><span className="text-navy/40">5.</span> /admin/prices → Excluded tab  <span className="text-navy/30 font-sans ml-2">— 除外理由を確認 ← now</span></p>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

type Highlight = "green" | "amber" | "red" | "neutral";

function StatCard({
  label,
  value,
  highlight = "neutral",
}: {
  label:      string;
  value:      string;
  highlight?: Highlight;
}) {
  const colors: Record<Highlight, string> = {
    green:   "text-gold-700",
    amber:   "text-amber-600",
    red:     "text-red-600",
    neutral: "text-navy",
  };
  return (
    <div className="border border-navy/10 bg-white p-4">
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${colors[highlight]}`}>
        {value}
      </p>
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

function IncludedBadge({ included }: { included: boolean }) {
  return included ? (
    <span className="inline-block rounded-sm bg-gold-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-700">
      ✓ YES
    </span>
  ) : (
    <span className="inline-block rounded-sm bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-red-600">
      ✗ NO
    </span>
  );
}

const REASON_STYLES: Record<RejectionReason, string> = {
  OUTLIER_IQR: "bg-red-50 text-red-600",
  STALE_48H:   "bg-amber-50 text-amber-600",
  LOW_TRUST:   "bg-orange-50 text-orange-600",
};

function RejectionBadges({ reasons }: { reasons: RejectionReason[] }) {
  if (reasons.length === 0) {
    return <span className="text-[10px] text-navy/25">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r) => (
        <span
          key={r}
          className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-medium ${REASON_STYLES[r]}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
      {message}
    </p>
  );
}

/** Trust スコアの成分をスコア下に小さく表示 */
function TrustBreakdownInline({ bd }: { bd: PriceRow["trustBreakdown"] }) {
  const sign  = (n: number) => n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
  const mult  = (n: number) => `×${n.toFixed(2)}`;
  const pct   = (n: number) => `${(n * 100).toFixed(0)}%`;

  return (
    <div className="mt-0.5 text-right font-mono text-[9px] leading-tight text-navy/30">
      <span title="source base score">{bd.sourceBase}</span>
      <span className={bd.weightDelta >= 0 ? "text-gold-400" : "text-red-300"}
            title={`trustWeight → ${mult(bd.weightedBase / Math.max(bd.sourceBase, 1))}`}>
        {" "}{sign(bd.weightDelta)}w
      </span>
      {bd.sellerBonus !== 0 && (
        <span className={bd.sellerBonus > 0 ? "text-sky-400" : "text-orange-300"}
              title="seller bonus">
          {" "}{sign(bd.sellerBonus)}s
        </span>
      )}
      <span className="text-navy/20"
            title={`listing: ${bd.listingLabel} (${pct(bd.listingMultiplier)})`}>
        {" "}×{bd.listingLabel.slice(0, 3)}
      </span>
    </div>
  );
}
