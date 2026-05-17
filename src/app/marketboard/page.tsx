import { getMarketboard } from "@/actions/market";
import { MarketTable } from "@/components/market/MarketTable";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  MARKET_SORT_KEYS,
  type MarketSortKey,
  type MarketSortOrder,
} from "@/types";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { q?: string; sort?: string; order?: string };
};

function parseSort(s: string | undefined): MarketSortKey | null {
  if (!s) return null;
  return (MARKET_SORT_KEYS as readonly string[]).includes(s)
    ? (s as MarketSortKey)
    : null;
}

function parseOrder(o: string | undefined): MarketSortOrder {
  return o === "asc" ? "asc" : "desc";
}

export default async function MarketboardPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() || undefined;
  const sort = parseSort(searchParams.sort);
  const order = parseOrder(searchParams.order);

  const rows = await getMarketboard({ search: q, sort, order });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-navy">Marketboard</h1>
        <p className="text-sm text-navy/60">
          Latest prices and 30-day weighted change across tracked cards.
        </p>
      </header>

      <SearchBar defaultValue={q} />

      {q ? (
        <p className="text-xs text-navy/50">
          Showing {rows.length} result{rows.length === 1 ? "" : "s"} for{" "}
          <span className="text-navy/70">&ldquo;{q}&rdquo;</span>
          {" · "}
          <a href="/marketboard" className="underline hover:text-navy">
            clear
          </a>
        </p>
      ) : null}

      <MarketTable rows={rows} sort={sort} order={order} query={q} />
    </div>
  );
}
