'use client';

import { useMemo, useState } from 'react';
import Link   from 'next/link';
import { useCurrency, formatCurrency, type Currency } from '@/lib/currency';
import { useLocale } from '@/i18n/context';
import { CardThumb } from '@/components/cards/CardThumb';
import { getSetDisplayName } from '@gci/core';
import type { MarketboardRow, MarketSortKey, MarketSortOrder } from '@gci/core';
import type { Locale } from '@/i18n/config';

// Column label subset used in this table
type TableLabels = {
  colCard:        string;
  colSet:         string;
  colCond:        string;
  colConfidence:  string;
  colIndex:       string;
  colIndexChange: string;
  colSamples:     string;
  colLatest:      string;
  colChange30d:   string;
  setFilterLabel?: string;
  setFilterAll?:   string;
};

type Props = {
  rows:    MarketboardRow[];
  sort?:   MarketSortKey | null;
  order?:  MarketSortOrder;
  query?:  string;
  locale?: Locale;
  labels?: TableLabels;
  thumbs?: Record<string, string>;
};

export function MarketTable({ rows, sort = null, order = 'desc', query, locale = 'ja', labels, thumbs = {} }: Props) {
  const { currency } = useCurrency();
  const ctxLocale    = useLocale();
  const loc          = locale || ctxLocale;
  const l            = labels ?? defaultLabels;

  // セット（ボックス）ごとの絞り込み。行数の多い順に並べる
  const [selectedSet, setSelectedSet] = useState('');
  const setOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.setName, (counts.get(r.setName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
  }, [rows]);
  const visibleRows = selectedSet ? rows.filter((r) => r.setName === selectedSet) : rows;

  if (rows.length === 0) {
    return (
      <p className="border border-navy/10 bg-white p-6 text-sm text-navy/50">
        No cards match the current filter.
      </p>
    );
  }

  return (
    <div>
      {setOptions.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-xs">
          <label htmlFor="set-filter" className="text-navy/50">
            {l.setFilterLabel ?? defaultLabels.setFilterLabel}
          </label>
          <select
            id="set-filter"
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="max-w-[280px] border border-navy/20 bg-white px-2 py-1.5 text-xs text-navy"
          >
            <option value="">{l.setFilterAll ?? defaultLabels.setFilterAll} ({rows.length})</option>
            {setOptions.map(([name, n]) => (
              <option key={name} value={name}>{getSetDisplayName(name)} ({n})</option>
            ))}
          </select>
        </div>
      )}
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
          <tr>
            <th className="px-4 py-3">{l.colCard}</th>
            <th className="px-4 py-3">{l.colSet}</th>
            <th className="px-4 py-3">{l.colCond}</th>
            <th className="px-4 py-3">{l.colConfidence}</th>
            <th className="px-4 py-3 text-right">{l.colIndex}</th>
            <th className="px-4 py-3 text-right">{l.colIndexChange}</th>
            <th className="px-4 py-3 text-right">{l.colSamples}</th>
            <th className="px-4 py-3 text-right">{l.colLatest} ({currency})</th>
            <th className="px-4 py-3 text-right">{l.colChange30d}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {visibleRows.map((row) => (
            <MarketRow key={row.cardId} row={row} currency={currency} locale={loc} thumb={thumbs[row.cardId]} />
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MarketRow({ row, currency, locale, thumb }: { row: MarketboardRow; currency: Currency; locale: string; thumb?: string }) {
  const displayPrice =
    row.latestPrice != null && row.currency
      ? formatCurrency(row.latestPrice, row.currency as Currency, currency, locale)
      : null;

  return (
    <tr className="text-navy/80 transition hover:bg-navy/[0.02]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardThumb src={thumb} char={row.name?.slice(0, 1) ?? '?'} />
          <Link href={`/cards/${row.cardId}`} className="font-medium text-navy hover:text-gold-700 transition truncate">
            {row.name}
          </Link>
        </div>
      </td>
      <td className="max-w-[160px] truncate px-4 py-3 text-xs text-navy/50" title={getSetDisplayName(row.setName)}>{getSetDisplayName(row.setName)}</td>
      <td className="px-4 py-3"><CondBadge condition={row.condition} /></td>
      <td className="px-4 py-3">
        {row.confidence
          ? <ConfidenceBadge tier={row.confidence} />
          : <span className="text-xs text-navy/25">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
        {row.indexValue != null ? row.indexValue.toFixed(1) : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {row.indexChange != null ? <ChangeRate rate={row.indexChange} /> : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-navy/55">
        {row.sampleCount != null ? row.sampleCount : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium">
        {displayPrice ?? <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {row.changeRate != null ? <ChangeRate rate={row.changeRate} /> : <span className="text-navy/25">—</span>}
      </td>
    </tr>
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

function ChangeRate({ rate }: { rate: number }) {
  const color  = rate > 0 ? 'text-gold-700' : rate < 0 ? 'text-red-600' : 'text-navy/40';
  const prefix = rate > 0 ? '▲' : rate < 0 ? '▼' : '';
  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(1)}%
    </span>
  );
}

const defaultLabels: TableLabels = {
  colCard:        'Card',
  colSet:         'Set',
  colCond:        'Cond',
  colConfidence:  'Confidence',
  colIndex:       'Index',
  colIndexChange: 'Δ Index',
  colSamples:     'Samples',
  colLatest:      'Latest',
  colChange30d:   'Δ 30d',
  setFilterLabel: 'Set',
  setFilterAll:   'All sets',
};
