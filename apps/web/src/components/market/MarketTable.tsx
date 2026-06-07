'use client';

import Link   from 'next/link';
import { useCurrency, formatCurrency, type Currency } from '@/lib/currency';
import { useLocale } from '@/i18n/context';
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
};

type Props = {
  rows:    MarketboardRow[];
  sort?:   MarketSortKey | null;
  order?:  MarketSortOrder;
  query?:  string;
  locale?: Locale;
  labels?: TableLabels;
};

export function MarketTable({ rows, sort = null, order = 'desc', query, locale = 'ja', labels }: Props) {
  const { currency } = useCurrency();
  const ctxLocale    = useLocale();
  const loc          = locale || ctxLocale;
  const l            = labels ?? defaultLabels;

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
          {rows.map((row) => (
            <MarketRow key={row.cardId} row={row} currency={currency} locale={loc} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MarketRow({ row, currency, locale }: { row: MarketboardRow; currency: Currency; locale: string }) {
  const displayPrice =
    row.latestPrice != null && row.currency
      ? formatCurrency(row.latestPrice, row.currency as Currency, currency, locale)
      : null;

  return (
    <tr className="text-navy/80 transition hover:bg-navy/[0.02]">
      <td className="px-4 py-3">
        <Link href={`/cards/${row.cardId}`} className="font-medium text-navy hover:text-gold-700 transition">
          {row.name}
        </Link>
      </td>
      <td className="max-w-[120px] truncate px-4 py-3 text-xs text-navy/50">{row.setName}</td>
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
};
