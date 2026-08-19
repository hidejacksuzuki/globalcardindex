import type { Metadata }  from 'next';
import Link               from 'next/link';
import { GAMES }          from '@gci/core';
import { getTranslations } from '@/i18n';
import type { Locale }    from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn = params.locale === 'en';
  return {
    title: isEn
      ? 'Games | Global Card Index'
      : 'カードゲーム別相場 | Global Card Index',
    description: isEn
      ? 'Browse trading card market indices by game — Pokémon TCG, One Piece Card Game, Yu-Gi-Oh! OCG, and Magic: The Gathering.'
      : 'ポケモンカード・ワンピースカード・遊戯王OCG・マジックの市場価格指数を一覧。ゲーム別の相場動向を確認できます。',
  };
}

export default function GamesPage({ params }: { params: { locale: Locale } }) {
  const t  = getTranslations(params.locale);
  const isEn = params.locale === 'en';

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/50">Market Data</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">{t.games.title}</h1>
        <p className="mt-1 text-sm text-navy/50">
          {isEn
            ? 'Browse market price indices and set data by game in real time.'
            : 'ゲーム別の市場価格指数・セット相場をリアルタイムで追跡。'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.filter((game) => !game.hidden).map((game) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="group border border-navy/10 bg-white p-6 transition hover:border-navy/30 hover:shadow-sm"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{game.emoji}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-navy group-hover:underline underline-offset-2">
                  {game.name}
                </h2>
                <p className="text-sm text-navy/50">{game.nameJa}</p>
                <p className="mt-2 text-xs text-navy/40 line-clamp-2">
                  {game.description}
                </p>
              </div>
              <span className="shrink-0 text-navy/30 transition group-hover:text-navy/60">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
