import { getIndexComposition } from "@/actions/admin";
import { formatDateTime }       from "@/lib/utils/formatDate";
import { formatPrice }          from "@/lib/utils/formatPrice";
import { notFound }             from "next/navigation";
import Link                     from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminIndexCompositionPage({
  params,
}: {
  params: { slug: string };
}) {
  const comp = await getIndexComposition(params.slug);
  if (!comp) notFound();

  const { indexValue: iv, cards, totalPrices, totalCards, recomputedAvg } = comp;

  return (
    <div className="space-y-10">
      {/* ── ヘッダー ── */}
      <header className="border-b border-navy/10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Index</p>
            <h1 className="mt-1 text-2xl font-semibold text-navy">
              Index Composition
            </h1>
            <p className="mt-1 text-sm text-navy/50">
              {formatDateTime(iv.calculatedAt)} 時点での採用価格プール
            </p>
          </div>
          <Link
            href="/admin/index"
            className="text-xs text-navy/40 hover:text-navy underline underline-offset-2"
          >
            ← Index 一覧
          </Link>
        </div>
      </header>

      {/* ── 指数サマリー ── */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="Index Value" value={iv.value.toLocaleString("ja-JP", {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })} />
          <InfoCard
            label="Change"
            value={`${iv.changeRate >= 0 ? "▲" : "▼"}${Math.abs(iv.changeRate).toFixed(2)}%`}
            highlight={iv.changeRate > 0 ? "green" : iv.changeRate < 0 ? "red" : "neutral"}
          />
          <InfoCard label="Cards"  value={totalCards.toLocaleString()}  />
          <InfoCard label="Prices" value={totalPrices.toLocaleString()} />
        </div>

        {recomputedAvg !== null && (
          <p className="mt-3 text-[11px] text-navy/40">
            ※ 現時点クリーン価格の単純平均（参考値）:&nbsp;
            <span className="font-mono font-medium text-navy/60">
              {formatPrice(recomputedAvg, "JPY")}
            </span>
            &nbsp;— isStale/isOutlier は現在フラグのため過去との差異があります。
          </p>
        )}
      </section>

      {/* ── カード別内訳 ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Cards in composition
          <span className="ml-2 normal-case text-navy/30">({totalCards} cards · {totalPrices} prices)</span>
        </h2>

        {cards.length === 0 ? (
          <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
            この時点ではクリーン価格が存在しません。
          </p>
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3 text-right">Prices</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Max</th>
                  <th className="px-4 py-3 text-right">Spread</th>
                  <th className="px-4 py-3 text-right">Avg Trust</th>
                  <th className="px-4 py-3 text-right">Index weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {cards.map((c, i) => {
                  const spread = c.maxPrice > 0
                    ? ((c.maxPrice - c.minPrice) / c.maxPrice) * 100
                    : 0;
                  // 信頼加重インデックス寄与度（件数 × 平均trust / 全体合計の概算）
                  const weight = totalPrices > 0
                    ? ((c.priceCount * c.avgTrust) / (totalPrices * 50)) * 100
                    : 0;

                  return (
                    <tr key={c.cardId} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 text-navy/30 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-navy">{c.cardName}</td>
                      <td className="px-4 py-3 text-xs text-navy/50">{c.setName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                        {c.priceCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-navy">
                        {formatPrice(c.avgPrice, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
                        {formatPrice(c.minPrice, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
                        {formatPrice(c.maxPrice, c.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <SpreadBadge value={spread} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <TrustBadge score={c.avgTrust} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
                        {weight.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 透明性ノート ── */}
      <section className="border border-navy/10 bg-navy/[0.02] p-6">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Transparency note</h2>
        <div className="space-y-1.5 text-sm text-navy/60">
          <p>
            採用条件: <code className="text-xs text-navy/80">isOutlier = false</code> かつ{" "}
            <code className="text-xs text-navy/80">isStale = false</code> かつ{" "}
            <code className="text-xs text-navy/80">trustScore ≥ 30</code>
          </p>
          <p>
            Index weight は概算値（件数 × 平均trust）。実際の計算は IQR 除外後の trust 加重平均。
          </p>
          <p>
            isStale / isOutlier フラグは現在時点のため、過去の指数との構成に差異が生じる場合があります。
          </p>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

type Highlight = "green" | "red" | "neutral";

function InfoCard({
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
    red:     "text-red-600",
    neutral: "text-navy",
  };
  return (
    <div className="border border-navy/10 bg-white p-4">
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${colors[highlight]}`}>{value}</p>
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

function SpreadBadge({ value }: { value: number }) {
  const color =
    value > 50 ? "text-red-600"
    : value > 20 ? "text-amber-600"
    : "text-navy/40";
  return <span className={`tabular-nums text-xs ${color}`}>{value.toFixed(1)}%</span>;
}
