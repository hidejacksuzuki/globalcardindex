import type { Metadata }  from 'next';
import Link               from 'next/link';
import { getTopGainers, getCardThumbnails }  from '@gci/core';
import { TrendTable }     from '@/components/market/TrendTable';
import { getTranslations } from '@/i18n';
import type { Locale }    from '@/i18n/config';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn = params.locale === 'en';
  return {
    title:       'Top Gainers | Global Card Index',
    description: isEn
      ? 'Trading cards with the biggest 7-day price increases — Pokémon, One Piece, Yu-Gi-Oh!, MTG.'
      : '7日間で最も値上がりしたトレカランキング。ポケカ・ワンピース・遊戯王の高騰カードをリアルタイム追跡。',
  };
}

export default async function GainersPage({ params }: { params: { locale: Locale } }) {
  const t    = getTranslations(params.locale);
  const isEn = params.locale === 'en';
  const cards  = await getTopGainers(50).catch(() => []);
  const thumbs = await getCardThumbnails(cards.map((c) => c.cardId)).catch(() => ({}));

  const statLabels = isEn
    ? { top: 'Top Gain', count: 'Ranked', avg: 'Avg Gain' }
    : { top: '1位の上昇率', count: 'ランクイン数', avg: '平均上昇率' };

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-navy">{t.gainers.title}</h1>
              <span className="rounded-sm border border-gold-300 bg-gold-50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold-700">
                7d ▲
              </span>
            </div>
            <p className="mt-1 text-sm text-navy/50">{t.gainers.description}</p>
          </div>
          <MarketNav active="gainers" />
        </div>
      </header>

      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label={statLabels.top}
            value={cards[0]?.change7d !== null ? `+${cards[0].change7d!.toFixed(1)}%` : '—'}
            color="text-gold-700"
          />
          <StatCard
            label={statLabels.count}
            value={`${cards.length} cards`}
            color="text-navy"
          />
          <StatCard
            label={statLabels.avg}
            value={
              cards.filter((c) => c.change7d !== null).length > 0
                ? `+${(
                    cards.reduce((s, c) => s + (c.change7d ?? 0), 0) /
                    cards.filter((c) => c.change7d !== null).length
                  ).toFixed(1)}%`
                : '—'
            }
            color="text-gold-600"
          />
        </div>
      )}

      <TrendTable cards={cards} mode="gainers" thumbs={thumbs} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-navy/10 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function MarketNav({ active }: { active: 'trending' | 'gainers' | 'losers' }) {
  const links = [
    { href: '/trending', label: '🔥 Trending', id: 'trending' as const },
    { href: '/gainers',  label: '▲ Gainers',   id: 'gainers'  as const },
    { href: '/losers',   label: '▼ Losers',    id: 'losers'   as const },
  ];
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => (
        <Link
          key={l.id}
          href={l.href}
          className={[
            'px-3 py-1.5 text-xs uppercase tracking-widest transition rounded-sm',
            l.id === active
              ? 'bg-navy text-white'
              : 'border border-navy/15 text-navy/50 hover:border-navy/30 hover:text-navy',
          ].join(' ')}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
