/**
 * /cards — i18n対応版
 */

import Link             from 'next/link';
import { listCards, formatPrice } from '@gci/core';
import { SearchBar }    from '@/components/ui/SearchBar';
import type { CardSortKey, SortOrder } from '@gci/core';
import { prisma }       from '@gci/db';
import { Disclaimer }          from '@/components/common/Disclaimer';
import { CardRequestButton }   from '@/components/cards/CardRequestButton';
import { getTranslations }     from '@/i18n';
import type { Locale }         from '@/i18n/config';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 100;

type Props = {
  params: { locale: Locale };
  searchParams: {
    q?:          string;
    sort?:       string;
    order?:      string;
    page?:       string;
    pageSize?:   string;
    game?:       string;
    condition?:  string;
    confidence?: string;
  };
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseSort(raw: string | undefined): CardSortKey {
  return raw === 'latestPrice' ? 'latestPrice' : 'name';
}

function parseOrder(raw: string | undefined): SortOrder {
  return raw === 'desc' ? 'desc' : 'asc';
}

export default async function CardsPage({ params, searchParams }: Props) {
  const t          = getTranslations(params.locale);
  const isEn       = params.locale === 'en';
  const q          = searchParams.q?.trim()         || undefined;
  const gameFilter = searchParams.game?.trim()       || undefined;
  const condFilter = searchParams.condition?.trim()  || undefined;
  const confFilter = searchParams.confidence?.trim() || undefined;
  const sort       = parseSort(searchParams.sort);
  const order      = parseOrder(searchParams.order);
  const page       = Math.max(1, parsePositiveInt(searchParams.page, 1));
  const pageSize   = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parsePositiveInt(searchParams.pageSize, DEFAULT_PAGE_SIZE)),
  );

  const result = await listCards({ search: q, sort, order, page, pageSize });
  const { cards, totalCount, totalPages } = result;

  const cardIds = cards.map((c) => c.id);
  const indexRows = await prisma.indexValue.findMany({
    where:   { cardId: { in: cardIds } },
    orderBy: { calculatedAt: 'desc' },
    select: {
      cardId:       true,
      value:        true,
      sampleCount:  true,
      outlierCount: true,
      confidence:   true,
      changeRate:   true,
    },
  });

  const indexMap = new Map<string, typeof indexRows[0]>();
  for (const row of indexRows) {
    if (row.cardId && !indexMap.has(row.cardId)) {
      indexMap.set(row.cardId, row);
    }
  }

  const displayedCards = confFilter
    ? cards.filter((c) => {
        const idx = indexMap.get(c.id);
        if (confFilter === 'none') return !idx;
        return idx?.confidence === confFilter;
      })
    : cards;

  const condFiltered = condFilter
    ? displayedCards.filter((c) => c.condition === condFilter)
    : displayedCards;

  const allConditions = [...new Set(cards.map((c) => c.condition))].sort();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-navy">{t.cards.title}</h1>
        <p className="text-sm text-navy/60">{t.cards.description}</p>
      </header>

      <SearchBar
        action="/cards"
        defaultValue={q}
        placeholder={t.cards.searchPlaceholder}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {allConditions.map((cond) => (
          <FilterPill
            key={cond}
            label={cond}
            href={buildFilterHref({ q, sort, order, condition: condFilter === cond ? undefined : cond, confidence: confFilter })}
            active={condFilter === cond}
          />
        ))}
        {condFilter && (
          <FilterPill
            label={isEn ? '× Condition' : '× Condition'}
            href={buildFilterHref({ q, sort, order, confidence: confFilter })}
            active={false}
            clear
          />
        )}
        <span className="mx-1 h-4 w-px bg-navy/15" />
        {(['HIGH', 'MED', 'LOW'] as const).map((tier) => (
          <FilterPill
            key={tier}
            label={tier}
            href={buildFilterHref({ q, sort, order, condition: condFilter, confidence: confFilter === tier ? undefined : tier })}
            active={confFilter === tier}
            confidence={tier}
          />
        ))}
        <FilterPill
          label={isEn ? 'No index' : 'No index'}
          href={buildFilterHref({ q, sort, order, condition: condFilter, confidence: confFilter === 'none' ? undefined : 'none' })}
          active={confFilter === 'none'}
        />
        {confFilter && (
          <FilterPill
            label={isEn ? '× Confidence' : '× Confidence'}
            href={buildFilterHref({ q, sort, order, condition: condFilter })}
            active={false}
            clear
          />
        )}
      </div>

      {/* Count line */}
      <p className="text-xs text-navy/50">
        {q ? (
          <>
            {totalCount} {t.search.results}{' '}
            <span className="text-navy/70">&ldquo;{q}&rdquo;</span>
            {' · '}
            <Link href="/cards" className="underline hover:text-navy">{t.search.clear}</Link>
          </>
        ) : (
          <>
            {totalCount} {isEn ? 'cards' : 'カード収録'}
          </>
        )}
        {condFiltered.length !== cards.length && (
          <> · {condFiltered.length} {isEn ? 'shown' : '件表示中'}</>
        )}
      </p>

      {/* Table */}
      {condFiltered.length === 0 ? (
        <div className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/50 space-y-3">
          <p>{t.cards.noCards}</p>
          {q && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-navy/40">
                {isEn
                  ? 'Not tracked yet?'
                  : 'お探しのカードはまだ収録されていませんか？'}
              </span>
              <CardRequestButton defaultName={q} />
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-4 py-3">
                  <SortLink k="name" sort={sort} order={order} q={q}>{t.cards.colCard}</SortLink>
                </th>
                <th className="px-4 py-3">{t.cards.colSet}</th>
                <th className="px-4 py-3">{t.cards.colCondition}</th>
                <th className="px-4 py-3">{t.cards.colConfidence}</th>
                <th className="px-4 py-3 text-right">{t.cards.colIndex}</th>
                <th className="px-4 py-3 text-right">Δ</th>
                <th className="px-4 py-3 text-right">{t.cards.colSamples}</th>
                <th className="px-4 py-3 text-right">
                  <SortLink k="latestPrice" sort={sort} order={order} q={q}>
                    {t.cards.colLatestPrice}
                  </SortLink>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {condFiltered.map((c) => {
                const idx = indexMap.get(c.id);
                return (
                  <tr key={c.id} className="text-navy/80 transition hover:bg-navy/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cards/${c.slug ?? c.id}`}
                        className="font-medium text-navy hover:text-gold-700 transition"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="max-w-[120px] truncate px-4 py-3 text-navy/55 text-xs">
                      {c.setName}
                    </td>
                    <td className="px-4 py-3">
                      <CondBadge condition={c.condition} />
                    </td>
                    <td className="px-4 py-3">
                      {idx?.confidence
                        ? <ConfidenceBadge tier={idx.confidence} />
                        : <span className="text-navy/25 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-navy">
                      {idx?.value != null
                        ? idx.value.toFixed(1)
                        : <span className="text-navy/25">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {idx?.changeRate != null
                        ? <ChangeRate rate={idx.changeRate} />
                        : <span className="text-navy/25">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy/55">
                      {idx?.sampleCount != null
                        ? idx.sampleCount
                        : <span className="text-navy/25">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {c.latestPrice !== null && c.currency
                        ? formatPrice(c.latestPrice, c.currency)
                        : <span className="text-navy/25">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          query={q}
          sort={sort}
          order={order}
          pageSize={pageSize}
          condition={condFilter}
          confidence={confFilter}
          isEn={isEn}
        />
      )}

      <Disclaimer variant="banner" />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFilterHref(params: {
  q?:          string;
  sort?:       CardSortKey;
  order?:      SortOrder;
  condition?:  string;
  confidence?: string;
}): string {
  const p = new URLSearchParams();
  if (params.q)          p.set('q',          params.q);
  if (params.sort && params.sort !== 'name') p.set('sort', params.sort);
  if (params.order && params.order !== 'asc') p.set('order', params.order);
  if (params.condition)  p.set('condition',  params.condition);
  if (params.confidence) p.set('confidence', params.confidence);
  const qs = p.toString();
  return qs ? `/cards?${qs}` : '/cards';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SortLink({
  k, sort, order, q, children,
}: {
  k: CardSortKey; sort: CardSortKey; order: SortOrder; q?: string;
  children: React.ReactNode;
}) {
  const nextOrder: SortOrder = sort === k && order === 'asc' ? 'desc' : 'asc';
  const params = new URLSearchParams();
  if (q)            params.set('q',     q);
  if (k !== 'name') params.set('sort',  k);
  if (nextOrder !== 'asc') params.set('order', nextOrder);
  const arrow = sort === k ? (order === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Link href={`/cards?${params.toString()}`} className="inline-flex items-center gap-1 hover:text-navy">
      {children}<span className="text-[9px]">{arrow || ' ↕'}</span>
    </Link>
  );
}

function FilterPill({
  label, href, active, confidence, clear,
}: {
  label: string; href: string; active: boolean;
  confidence?: 'HIGH' | 'MED' | 'LOW'; clear?: boolean;
}) {
  const confColors: Record<string, string> = {
    HIGH: active ? 'bg-green-600 text-white border-green-600' : 'border-green-300 text-green-700 hover:bg-green-50',
    MED:  active ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-300 text-amber-700 hover:bg-amber-50',
    LOW:  active ? 'bg-red-500 text-white border-red-500'     : 'border-red-300 text-red-700 hover:bg-red-50',
  };
  const base = clear
    ? 'border-navy/20 text-navy/40 hover:text-navy/70'
    : confidence
      ? confColors[confidence]
      : active
        ? 'bg-navy text-white border-navy'
        : 'border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy';

  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${base}`}
    >
      {label}
    </Link>
  );
}

function CondBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NM:  'bg-green-100 text-green-700',
    LP:  'bg-blue-100  text-blue-700',
    MP:  'bg-amber-100 text-amber-700',
    HP:  'bg-red-100   text-red-700',
    DMG: 'bg-red-200   text-red-800',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[condition] ?? 'bg-navy/10 text-navy/50'}`}>
      {condition}
    </span>
  );
}

function ConfidenceBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-green-100 text-green-700',
    MED:  'bg-amber-100 text-amber-700',
    LOW:  'bg-red-100   text-red-600',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[tier] ?? 'bg-navy/10 text-navy/50'}`}>
      {tier}
    </span>
  );
}

function ChangeRate({ rate }: { rate: number }) {
  const color  = rate > 0 ? 'text-gold-700' : rate < 0 ? 'text-red-600' : 'text-navy/40';
  const prefix = rate > 0 ? '▲' : rate < 0 ? '▼' : '';
  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(1)}%
    </span>
  );
}

function Pagination({
  currentPage, totalPages, query, sort, order, pageSize, condition, confidence, isEn,
}: {
  currentPage: number; totalPages: number; query?: string;
  sort: CardSortKey; order: SortOrder; pageSize: number;
  condition?: string; confidence?: string; isEn: boolean;
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (query)                          params.set('q',          query);
    if (sort !== 'name')                params.set('sort',       sort);
    if (order !== 'asc')                params.set('order',      order);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize',   String(pageSize));
    if (condition)                      params.set('condition',  condition);
    if (confidence)                     params.set('confidence', confidence);
    if (p > 1)                          params.set('page',       String(p));
    const qs = params.toString();
    return qs ? `/cards?${qs}` : '/cards';
  };

  const prev = currentPage > 1          ? buildHref(currentPage - 1) : null;
  const next = currentPage < totalPages ? buildHref(currentPage + 1) : null;
  const prevLabel = isEn ? 'Previous' : 'Previous';
  const nextLabel = isEn ? 'Next' : 'Next';

  return (
    <nav className="flex items-center justify-between text-xs text-navy/60">
      <span>Page {currentPage} / {totalPages}</span>
      <div className="flex gap-2">
        {prev
          ? <Link href={prev} className="border border-navy/10 bg-white px-3 py-1 transition hover:border-navy">{prevLabel}</Link>
          : <span className="border border-navy/10 bg-navy/5 px-3 py-1 text-navy/30">{prevLabel}</span>
        }
        {next
          ? <Link href={next} className="border border-navy/10 bg-white px-3 py-1 transition hover:border-navy">{nextLabel}</Link>
          : <span className="border border-navy/10 bg-navy/5 px-3 py-1 text-navy/30">{nextLabel}</span>
        }
      </div>
    </nav>
  );
}
