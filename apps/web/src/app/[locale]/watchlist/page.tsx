import Link                from 'next/link';
import {
  getWatchlistCards,
  type WatchlistCard,
  type PriceSignal,
  type SignalType,
  formatPrice,
  formatDateTime,
} from '@gci/core';
import { WatchButton }          from '@/components/watchlist/WatchButton';
import { QuickPortfolioButton } from '@/components/portfolio/QuickPortfolioButton';
import { auth }                 from '@/auth';
import { getTranslations }      from '@/i18n';
import type { Locale }          from '@/i18n/config';
import { prisma }               from '@gci/db';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage({ params }: { params: { locale: Locale } }) {
  const t       = getTranslations(params.locale);
  const isEn    = params.locale === 'en';
  const session = await auth();
  const userId  = session?.user?.id ?? null;
  const cards   = await getWatchlistCards();

  // Portfolioに登録済みのカードIDセットをサーバー側で取得
  const portfolioCardIds: Set<string> = userId
    ? await prisma.portfolioCard.findMany({
        where:  { userId },
        select: { cardId: true },
      }).then((rows) => new Set(rows.map((r) => r.cardId))).catch(() => new Set())
    : new Set();

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <h1 className="text-2xl font-semibold text-navy">{t.watchlist.title}</h1>
        <p className="mt-1 text-sm text-navy/50">{t.watchlist.description}</p>
      </header>

      {cards.length === 0 ? (
        <EmptyState isEn={isEn} />
      ) : (
        <>
          {cards.some((c) => c.signals.length > 0) && (
            <section>
              <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Alerts</h2>
              <div className="space-y-3">
                {cards
                  .filter((c) => c.signals.length > 0)
                  .map((card) => (
                    <AlertCard key={card.cardId} card={card} />
                  ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
              {isEn ? 'All watched cards' : '全ウォッチ中カード'}
              <span className="ml-2 text-navy/30 normal-case">({cards.length})</span>
            </h2>
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Set</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">7d</th>
                    <th className="px-4 py-3">Signals</th>
                    <th className="px-4 py-3">{isEn ? 'Added' : '追加日'}</th>
                    <th className="px-4 py-3">Portfolio</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {cards.map((card) => (
                    <tr key={card.cardId} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/cards/${card.cardId}`}
                          className="font-medium text-navy hover:underline underline-offset-2"
                        >
                          {card.cardName}
                        </Link>
                        <p className="text-[10px] text-navy/40">
                          {card.rarity} · {card.condition}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-navy/50 text-xs">{card.setName}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-navy">
                        {card.latestPrice !== null && card.currency
                          ? formatPrice(card.latestPrice, card.currency)
                          : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Change7d value={card.change7d} />
                      </td>
                      <td className="px-4 py-3">
                        <SignalBadges signals={card.signals} />
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/40 tabular-nums">
                        {formatDateTime(card.addedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {userId ? (
                          <QuickPortfolioButton
                            cardId={card.cardId}
                            inPortfolio={portfolioCardIds.has(card.cardId)}
                          />
                        ) : (
                          <span className="text-[10px] text-navy/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <WatchButton cardId={card.cardId} isWatched={true} userId={userId ?? undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState({ isEn }: { isEn: boolean }) {
  return (
    <div className="border border-navy/10 bg-white p-12 text-center">
      <p className="text-3xl">☆</p>
      <p className="mt-3 text-sm font-medium text-navy">
        {isEn ? 'Your watchlist is empty' : 'ウォッチリストが空です'}
      </p>
      <p className="mt-1 text-xs text-navy/50">
        {isEn
          ? 'Add cards via the Watch button on any card detail page.'
          : 'カード詳細ページの「Watch」ボタンで追加できます。'}
      </p>
      <Link
        href="/cards"
        className="mt-6 inline-block border border-navy/20 px-4 py-2 text-xs uppercase tracking-widest text-navy/60 hover:border-navy/40 hover:text-navy transition"
      >
        {isEn ? 'Browse cards' : 'カード一覧へ'}
      </Link>
    </div>
  );
}

function AlertCard({ card }: { card: WatchlistCard }) {
  const hasBull = card.signals.some((s) => s.type === 'up' || s.type === 'new_high');
  const border  = hasBull ? 'border-gold-300 bg-gold-50/40' : 'border-red-200 bg-red-50/30';

  return (
    <div className={`border p-4 ${border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/cards/${card.cardId}`}
            className="font-semibold text-navy hover:underline underline-offset-2"
          >
            {card.cardName}
          </Link>
          <p className="text-xs text-navy/50">{card.setName} · {card.rarity}</p>
        </div>
        <div className="text-right shrink-0">
          {card.latestPrice !== null && card.currency && (
            <p className="text-lg font-semibold tabular-nums text-navy">
              {formatPrice(card.latestPrice, card.currency)}
            </p>
          )}
          <Change7d value={card.change7d} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SignalBadges signals={card.signals} />
      </div>
    </div>
  );
}

function Change7d({ value }: { value: number | null }) {
  if (value === null) return <span className="text-navy/25 text-xs">—</span>;
  const isPos  = value > 0;
  const color  = isPos ? 'text-gold-700' : value < 0 ? 'text-red-600' : 'text-navy/40';
  const prefix = isPos ? '▲' : value < 0 ? '▼' : '';
  return (
    <span className={`tabular-nums text-xs ${color}`}>
      {prefix}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

const SIGNAL_STYLES: Record<SignalType, string> = {
  up:           'bg-gold-100 text-gold-700 border-gold-300',
  down:         'bg-red-50 text-red-600 border-red-200',
  new_high:     'bg-gold-200 text-gold-800 border-gold-400 font-semibold',
  new_low:      'bg-blue-50 text-blue-600 border-blue-200',
  volume_spike: 'bg-purple-50 text-purple-600 border-purple-200',
};

const SIGNAL_ICONS: Record<SignalType, string> = {
  up:           '▲',
  down:         '▼',
  new_high:     '★',
  new_low:      '◆',
  volume_spike: '⚡',
};

function SignalBadges({ signals }: { signals: PriceSignal[] }) {
  if (signals.length === 0) return <span className="text-[10px] text-navy/25">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((s, i) => (
        <span
          key={i}
          title={s.detail}
          className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-widest ${SIGNAL_STYLES[s.type]}`}
        >
          <span>{SIGNAL_ICONS[s.type]}</span>
          <span>{s.label}</span>
          {s.detail && (
            <span className="opacity-60 normal-case tracking-normal">({s.detail})</span>
          )}
        </span>
      ))}
    </div>
  );
}
