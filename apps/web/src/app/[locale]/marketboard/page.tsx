import Link            from 'next/link';
import { getMarketboard, getCardThumbnails, MARKET_SORT_KEYS } from '@gci/core';
import { SearchBar }   from '@/components/ui/SearchBar';
import { Disclaimer }  from '@/components/common/Disclaimer';
import { MarketTable } from '@/components/market/MarketTable';
import { getTranslations } from '@/i18n';
import type { Locale } from '@/i18n/config';
import type { MarketboardRow, MarketSortKey, MarketSortOrder } from '@gci/core';

export const dynamic = 'force-dynamic';

type Props = {
  params:       { locale: Locale };
  searchParams: { q?: string; sort?: string; order?: string; section?: string };
};

function parseSort(s: string | undefined): MarketSortKey | null {
  if (!s) return null;
  return (MARKET_SORT_KEYS as readonly string[]).includes(s) ? (s as MarketSortKey) : null;
}

function parseOrder(o: string | undefined): MarketSortOrder {
  return o === 'asc' ? 'asc' : 'desc';
}

export default async function MarketboardPage({ params, searchParams }: Props) {
  const t       = getTranslations(params.locale);
  const m       = t.marketboard;
  const q       = searchParams.q?.trim() || undefined;
  const sort    = parseSort(searchParams.sort);
  const order   = parseOrder(searchParams.order);
  const section = searchParams.section === 'reference' ? 'reference' : 'reliable';

  const rows = await getMarketboard({ search: q, sort, order });

  const reliable  = rows.filter((r) => r.confidence === 'HIGH' || r.confidence === 'MED');
  const reference = rows.filter((r) => r.confidence !== 'HIGH' && r.confidence !== 'MED');

  const activeRows = section === 'reliable' ? reliable : reference;
  const thumbs     = await getCardThumbnails(activeRows.map((r) => r.cardId)).catch(() => ({}));
  const updatedAt  = rows.length > 0
    ? rows.map((r) => r.lastObservedAt).filter(Boolean).sort().at(-1)
    : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="border-b border-navy/10 pb-5 space-y-1">
        <h1 className="text-2xl font-semibold text-navy">{m.title}</h1>
        <p className="text-sm text-navy/60">
          {m.description}
          {updatedAt && (
            <span className="ml-2 text-navy/40">
              {m.lastUpdated}: {new Date(updatedAt).toLocaleDateString(params.locale === 'en' ? 'en-US' : 'ja-JP')}
            </span>
          )}
        </p>
      </header>

      {/* Search */}
      <SearchBar action="/marketboard" defaultValue={q} placeholder={m.searchPlaceholder} />

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-navy/10">
        <SectionTab
          label={`${m.tabReliable} (${reliable.length})`}
          href={buildHref({ q, sort, order, section: 'reliable' })}
          active={section === 'reliable'}
        />
        <SectionTab
          label={`${m.tabReference} (${reference.length})`}
          href={buildHref({ q, sort, order, section: 'reference' })}
          active={section === 'reference'}
        />
      </div>

      {/* Reference explanation */}
      {section === 'reference' && reference.length > 0 && (
        <aside className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {m.referenceNote}
        </aside>
      )}

      {/* Search result count */}
      {q && (
        <p className="text-xs text-navy/50">
          {activeRows.length} {m.results}{' '}
          <span className="text-navy/70">&ldquo;{q}&rdquo;</span>
          {' · '}
          <a href="/marketboard" className="underline hover:text-navy">{m.clear}</a>
        </p>
      )}

      {/* Table */}
      {activeRows.length === 0 ? (
        <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/50">
          {q ? m.noCards : m.noCardsSection}
        </p>
      ) : (
        <MarketTable
          rows={activeRows}
          sort={sort}
          order={order}
          query={q}
          locale={params.locale}
          labels={m}
          thumbs={thumbs}
        />
      )}

      <Disclaimer variant="banner" />
    </div>
  );
}

function SectionTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2',
        active
          ? 'border-navy text-navy font-medium'
          : 'border-transparent text-navy/40 hover:text-navy/60',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

function buildHref(params: { q?: string; sort?: MarketSortKey | null; order?: MarketSortOrder; section?: string }): string {
  const p = new URLSearchParams();
  if (params.q)               p.set('q',       params.q);
  if (params.sort)            p.set('sort',    params.sort);
  if (params.order === 'asc') p.set('order',   'asc');
  if (params.section)         p.set('section', params.section);
  const qs = p.toString();
  return qs ? `/marketboard?${qs}` : '/marketboard';
}
