import type { CardSourceStat } from "@gci/core";

// ── ソース名の日本語表示 ─────────────────────────────────────
const LABELS: Record<string, string> = {
  mercari:              "メルカリ",
  yahuoku:              "ヤフオク",
  yahoo_auction:        "ヤフオク",
  yahoo_auction_active: "ヤフオク（進行中）",
  yahoo_auction_closed: "ヤフオク（落札）",
  ebay:                 "eBay",
  unknown:              "その他",
};

const BADGE: Record<string, string> = {
  mercari:              "bg-red-50   text-red-700   border-red-200",
  yahuoku:              "bg-orange-50 text-orange-700 border-orange-200",
  yahoo_auction:        "bg-orange-50 text-orange-700 border-orange-200",
  yahoo_auction_active: "bg-orange-50 text-orange-700 border-orange-200",
  yahoo_auction_closed: "bg-amber-50  text-amber-700  border-amber-200",
  ebay:                 "bg-blue-50  text-blue-700  border-blue-200",
};

function sourceLabel(source: string) {
  return LABELS[source] ?? source;
}

function sourceBadge(source: string) {
  return (BADGE[source] ?? "bg-navy/5 text-navy/60 border-navy/15") + " border rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap";
}

function fmt(price: number | null, currency: string): string {
  if (price === null) return "—";
  try {
    return new Intl.NumberFormat("ja-JP", {
      style:                 "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${Math.round(price)} ${currency}`;
  }
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 30)  return `${days}日前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

type Props = { stats: CardSourceStat[] };

export function SourceStats({ stats }: Props) {
  if (stats.length === 0) return null;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[520px] text-sm border-collapse">
        <thead>
          <tr className="border-b border-navy/8">
            <th className="py-2 px-3 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              ソース
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              最安値
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              中央値
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              平均値
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              最高値
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal">
              件数
            </th>
            <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest text-navy/40 font-normal hidden sm:table-cell">
              更新
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {stats.map((s) => (
            <tr key={s.source} className="hover:bg-navy/[0.02] transition-colors">
              <td className="py-3 px-3">
                <span className={sourceBadge(s.source)}>
                  {sourceLabel(s.source)}
                </span>
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-navy/60">
                {fmt(s.minPrice, s.currency)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums font-semibold text-navy">
                {fmt(s.medianPrice, s.currency)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-navy/60">
                {s.avgPrice !== null ? fmt(Math.round(s.avgPrice), s.currency) : "—"}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-navy/60">
                {fmt(s.maxPrice, s.currency)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-navy/50">
                {s.sampleCount.toLocaleString()}
              </td>
              <td className="py-3 px-3 text-right text-[11px] text-navy/30 hidden sm:table-cell">
                {relativeDate(s.capturedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
