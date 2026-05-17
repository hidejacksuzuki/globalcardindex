import Link from "next/link";
import { listCards } from "@/actions/cards";
import { SearchBar } from "@/components/ui/SearchBar";
import { formatPrice } from "@/lib/utils/formatPrice";
import { formatDateTime } from "@/lib/utils/formatDate";
import type { CardSortKey, SortOrder } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 100;

type Props = {
  searchParams: {
    q?:       string;
    sort?:    string;
    order?:   string;
    page?:    string;
    pageSize?: string;
  };
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseSort(raw: string | undefined): CardSortKey {
  return raw === "latestPrice" ? "latestPrice" : "name";
}

function parseOrder(raw: string | undefined): SortOrder {
  return raw === "desc" ? "desc" : "asc";
}

// ----------------------------------------------------------------
// ソートリンクを生成（同カラムを再クリックで asc ⇔ desc トグル）
// ----------------------------------------------------------------
function buildSortHref(
  key: CardSortKey,
  currentSort: CardSortKey,
  currentOrder: SortOrder,
  q?: string,
  pageSize?: number,
): string {
  const nextOrder: SortOrder =
    currentSort === key && currentOrder === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (q)                                          params.set("q",       q);
  if (key !== "name")                             params.set("sort",    key);
  if (nextOrder !== "asc")                        params.set("order",   nextOrder);
  if (pageSize && pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return qs ? `/cards?${qs}` : "/cards";
}

function sortArrow(key: CardSortKey, current: CardSortKey, order: SortOrder) {
  if (key !== current) return <span className="text-navy/25 text-[10px]">↕</span>;
  return (
    <span className="text-navy text-[10px]">{order === "asc" ? "↑" : "↓"}</span>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------
export default async function CardsPage({ searchParams }: Props) {
  const q        = searchParams.q?.trim() || undefined;
  const sort     = parseSort(searchParams.sort);
  const order    = parseOrder(searchParams.order);
  const page     = Math.max(1, parsePositiveInt(searchParams.page, 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE)),
  );

  const result = await listCards({ search: q, sort, order, page, pageSize });
  const { cards, totalCount, totalPages } = result;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-navy">Cards</h1>
        <p className="text-sm text-navy/60">Browse the catalog of tracked cards.</p>
      </header>

      <SearchBar
        action="/cards"
        defaultValue={q}
        placeholder="Search by card or set name"
      />

      {/* 件数・クリア */}
      {q ? (
        <p className="text-xs text-navy/50">
          Showing {totalCount} result{totalCount === 1 ? "" : "s"} for{" "}
          <span className="text-navy/70">&ldquo;{q}&rdquo;</span>
          {" · "}
          <Link href="/cards" className="underline hover:text-navy">clear</Link>
        </p>
      ) : (
        <p className="text-xs text-navy/50">
          {totalCount} card{totalCount === 1 ? "" : "s"} indexed
        </p>
      )}

      {/* テーブル */}
      {cards.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/50">
          No cards found.
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/60">
              <tr>
                {/* ── Card（名前順ソート） ── */}
                <th className="px-4 py-3">
                  <Link
                    href={buildSortHref("name", sort, order, q, pageSize)}
                    className="inline-flex items-center gap-1 hover:text-navy"
                  >
                    Card {sortArrow("name", sort, order)}
                  </Link>
                </th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Rarity</th>
                <th className="px-4 py-3">Condition</th>
                {/* ── Latest Price（価格順ソート） ── */}
                <th className="px-4 py-3 text-right">
                  <Link
                    href={buildSortHref("latestPrice", sort, order, q, pageSize)}
                    className="inline-flex items-center justify-end gap-1 hover:text-navy"
                  >
                    Latest Price {sortArrow("latestPrice", sort, order)}
                  </Link>
                </th>
                <th className="px-4 py-3 text-right">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className="text-navy/80 transition hover:bg-navy/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cards/${c.id}`}
                      className="font-medium text-navy transition hover:text-gold-700"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-navy/60">{c.setName}</td>
                  <td className="px-4 py-3">{c.rarity}</td>
                  <td className="px-4 py-3">{c.condition}</td>
                  {/* 価格列 */}
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {c.latestPrice !== null && c.currency
                      ? formatPrice(c.latestPrice, c.currency)
                      : <span className="text-navy/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
                    {c.lastObservedAt
                      ? formatDateTime(c.lastObservedAt)
                      : <span className="text-navy/25">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          query={q}
          sort={sort}
          order={order}
          pageSize={pageSize}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Pagination
// ----------------------------------------------------------------
function Pagination({
  currentPage,
  totalPages,
  query,
  sort,
  order,
  pageSize,
}: {
  currentPage: number;
  totalPages:  number;
  query?:      string;
  sort:        CardSortKey;
  order:       SortOrder;
  pageSize:    number;
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (query)                          params.set("q",        query);
    if (sort !== "name")                params.set("sort",     sort);
    if (order !== "asc")                params.set("order",    order);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
    if (p > 1)                          params.set("page",     String(p));
    const qs = params.toString();
    return qs ? `/cards?${qs}` : "/cards";
  };

  const prev = currentPage > 1            ? buildHref(currentPage - 1) : null;
  const next = currentPage < totalPages   ? buildHref(currentPage + 1) : null;

  return (
    <nav className="flex items-center justify-between text-xs text-navy/60">
      <span>Page {currentPage} / {totalPages}</span>
      <div className="flex gap-2">
        {prev ? (
          <Link href={prev} className="border border-navy/10 bg-white px-3 py-1 transition hover:border-navy">
            Previous
          </Link>
        ) : (
          <span className="border border-navy/10 bg-navy/5 px-3 py-1 text-navy/30">Previous</span>
        )}
        {next ? (
          <Link href={next} className="border border-navy/10 bg-white px-3 py-1 transition hover:border-navy">
            Next
          </Link>
        ) : (
          <span className="border border-navy/10 bg-navy/5 px-3 py-1 text-navy/30">Next</span>
        )}
      </div>
    </nav>
  );
}
