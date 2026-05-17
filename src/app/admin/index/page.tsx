import { getIndexList } from "@/actions/admin";
import { formatDateTime } from "@/lib/utils/formatDate";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const items = await getIndexList(30);

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Index History</h1>
        <p className="mt-1 text-sm text-navy/50">
          各 recalc の結果と採用価格の構成を確認します。
        </p>
      </header>

      {items.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          まだ IndexValue がありません。
          <code className="ml-1 text-xs">POST /api/v1/cron/recalc</code> を実行してください。
        </p>
      ) : (
        <section>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Calculated at</th>
                  <th className="px-4 py-3 text-right">Index value</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Composition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-navy/[0.02]">
                    <td className="px-4 py-3 text-xs tabular-nums text-navy/70">
                      {formatDateTime(item.calculatedAt)}
                      {i === 0 && (
                        <span className="ml-2 inline-block rounded-sm bg-gold-100 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-gold-700">
                          latest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
                      {item.value.toLocaleString("ja-JP", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <ChangeRate rate={item.changeRate} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-navy/30">
                      {item.id.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/index/${item.id}`}
                        className="text-xs text-navy/50 underline underline-offset-2 hover:text-navy"
                      >
                        採用カードを見る →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-navy/30">
            直近 30 件を表示。各行の「採用カードを見る」で指数構成の内訳を確認できます。
          </p>
        </section>
      )}
    </div>
  );
}

function ChangeRate({ rate }: { rate: number }) {
  const isPositive = rate > 0;
  const isZero     = rate === 0;
  const color = isZero ? "text-navy/40"
    : isPositive ? "text-gold-700"
    : "text-red-600";
  const prefix = isPositive ? "▲" : rate < 0 ? "▼" : "";
  return (
    <span className={`tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(2)}%
    </span>
  );
}
