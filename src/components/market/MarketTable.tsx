import Link from "next/link";
import { formatDateTime } from "@/lib/utils/formatDate";
import { formatPrice } from "@/lib/utils/formatPrice";
import type {
  MarketboardRow,
  MarketSortKey,
  MarketSortOrder,
} from "@/types";

type Props = {
  rows: MarketboardRow[];
  sort?: MarketSortKey | null;
  order?: MarketSortOrder;
  query?: string;
};

export function MarketTable({
  rows,
  sort = null,
  order = "desc",
  query,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="border border-navy/10 bg-white p-6 text-sm text-navy/50">
        No cards match the current filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/60">
          <tr>
            <th className="px-4 py-3">Card</th>
            <th className="px-4 py-3">Set</th>
            <th className="px-4 py-3">
              <SortHeader
                label="Latest"
                sortKey="price"
                currentSort={sort}
                currentOrder={order}
                query={query}
              />
            </th>
            <th className="px-4 py-3">
              <SortHeader
                label="Δ 30d"
                sortKey="changeRate"
                currentSort={sort}
                currentOrder={order}
                query={query}
              />
            </th>
            <th className="px-4 py-3">
              <SortHeader
                label="Points"
                sortKey="count"
                currentSort={sort}
                currentOrder={order}
                query={query}
              />
            </th>
            <th className="px-4 py-3">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {rows.map((r) => (
            <tr
              key={r.cardId}
              className="text-navy/80 transition hover:bg-navy/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/cards/${r.cardId}`}
                  className="block transition hover:text-gold-700"
                >
                  <div className="font-medium text-navy">{r.name}</div>
                  <div className="text-xs text-navy/50">
                    {r.rarity} · {r.condition}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3">{r.setName}</td>
              <td className="px-4 py-3 tabular-nums">
                {r.latestPrice !== null && r.currency
                  ? formatPrice(r.latestPrice, r.currency)
                  : "-"}
              </td>
              <td
                className={`px-4 py-3 tabular-nums ${
                  r.changeRate === null
                    ? "text-navy/40"
                    : r.changeRate >= 0
                      ? "text-gold-700"
                      : "text-red-700"
                }`}
              >
                {r.changeRate === null
                  ? "-"
                  : `${r.changeRate >= 0 ? "+" : ""}${r.changeRate.toFixed(2)}%`}
              </td>
              <td className="px-4 py-3 tabular-nums">{r.dataPoints}</td>
              <td className="px-4 py-3 tabular-nums">
                {r.lastObservedAt ? formatDateTime(r.lastObservedAt) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildSortHref(
  key: MarketSortKey,
  currentSort: MarketSortKey | null,
  currentOrder: MarketSortOrder,
  query?: string,
): string {
  // Toggle direction on the active column; new column defaults to desc
  // (most useful for "highest price / biggest mover / most observations").
  const nextOrder: MarketSortOrder =
    currentSort === key && currentOrder === "desc" ? "asc" : "desc";

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sort", key);
  params.set("order", nextOrder);
  return `/marketboard?${params.toString()}`;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  query,
}: {
  label: string;
  sortKey: MarketSortKey;
  currentSort: MarketSortKey | null;
  currentOrder: MarketSortOrder;
  query?: string;
}) {
  const isActive = currentSort === sortKey;
  const arrow = isActive ? (currentOrder === "asc" ? "↑" : "↓") : "↕";

  return (
    <Link
      href={buildSortHref(sortKey, currentSort, currentOrder, query)}
      className="inline-flex items-center gap-1 transition hover:text-navy"
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${isActive ? "text-navy" : "text-navy/30"}`}
        aria-hidden
      >
        {arrow}
      </span>
    </Link>
  );
}
