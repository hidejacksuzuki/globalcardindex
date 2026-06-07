import Link from 'next/link';
import {
  getLatestIndex,
  getIndexHistory,
  getPreviousDaySnapshot,
  INDEX_PERIODS,
  type IndexPeriodDays,
  formatDateTime,
} from '@gci/core';
import { IndexHero } from '@/components/index/IndexHero';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

type Props = {
  params:       { locale: Locale };
  searchParams: { period?: string };
};

function parsePeriod(raw: string | undefined): IndexPeriodDays {
  const n = Number(raw);
  return (INDEX_PERIODS as readonly number[]).includes(n) ? (n as IndexPeriodDays) : 30;
}

function buildPeriodHref(days: IndexPeriodDays): string {
  return days === 30 ? '/indices' : `/indices?period=${days}`;
}

export default async function IndicesPage({ params, searchParams }: Props) {
  const period = parsePeriod(searchParams.period);
  const isEn   = params.locale === 'en';

  const [latest, prevDay, history] = await Promise.all([
    getLatestIndex(),
    getPreviousDaySnapshot(),
    getIndexHistory(period),
  ]);

  const series = history.map((h) => h.value).reverse();

  const dayChangeRate =
    latest && prevDay && prevDay.value !== 0
      ? ((latest.value - prevDay.value) / prevDay.value) * 100
      : null;

  return (
    <div className="space-y-8">

      <IndexHero snapshot={latest} series={series} dayChangeRate={dayChangeRate} locale={params.locale} />

      {/* Period tabs */}
      <div className="flex items-center gap-1">
        {INDEX_PERIODS.map((d) => (
          <Link
            key={d}
            href={buildPeriodHref(d)}
            className={[
              'px-4 py-1.5 text-xs uppercase tracking-widest transition',
              d === period
                ? 'bg-navy text-white'
                : 'border border-navy/10 bg-white text-navy/60 hover:border-navy/30 hover:text-navy',
            ].join(' ')}
          >
            {d}D
          </Link>
        ))}
        <span className="ml-auto text-xs text-navy/40">
          {history.length} data point{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* History table */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/50">
          Index history · {period}D
        </h2>
        {history.length === 0 ? (
          <p className="border border-navy/10 bg-white p-6 text-sm text-navy/50">
            {isEn
              ? 'No history yet. Run recalc-index to generate the first value.'
              : 'まだデータがありません。recalc-index を実行してください。'}
          </p>
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/60">
                <tr>
                  <th className="px-4 py-3">Calculated</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Δ prev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {history.map((row, i) => {
                  const prev     = history[i + 1];
                  const delta    =
                    prev && prev.value !== 0
                      ? ((row.value - prev.value) / prev.value) * 100
                      : null;
                  const positive = delta !== null && delta >= 0;

                  return (
                    <tr key={row.calculatedAt} className="text-navy/80">
                      <td className="px-4 py-3 tabular-nums text-navy/60">
                        {formatDateTime(row.calculatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {row.value.toFixed(2)}
                      </td>
                      <td
                        className={[
                          'px-4 py-3 text-right tabular-nums',
                          delta === null
                            ? 'text-navy/30'
                            : positive
                              ? 'text-gold-700'
                              : 'text-red-700',
                        ].join(' ')}
                      >
                        {delta === null
                          ? '—'
                          : `${positive ? '+' : ''}${delta.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
