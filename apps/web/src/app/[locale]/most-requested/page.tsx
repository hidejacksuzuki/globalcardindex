/**
 * /most-requested — i18n対応版
 */

import type { Metadata }    from 'next';
import Link                 from 'next/link';
import { CardRequestButton } from '@/components/cards/CardRequestButton';
import type { Locale }      from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn = params.locale === 'en';
  return {
    title:  'Most Requested Cards | Global Card Index',
    description: isEn
      ? 'The most community-requested trading cards. A market demand signal for which cards to track next.'
      : 'コミュニティが最も追加を求めているトレカのリスト。市場需要のシグナルです。',
    robots: { index: true, follow: true },
  };
}

type Group = {
  name:  string;
  game:  string | null;
  count: number;
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://gci-index.com';

const GAME_LABEL_JA: Record<string, string> = {
  pokemon:  'ポケカ',
  onepiece: 'ワンピース',
  yugioh:   '遊戯王',
  mtg:      'MTG',
  other:    'その他',
};

const GAME_LABEL_EN: Record<string, string> = {
  pokemon:  'Pokémon',
  onepiece: 'One Piece',
  yugioh:   'Yu-Gi-Oh!',
  mtg:      'MTG',
  other:    'Other',
};

const GAME_COLOR: Record<string, string> = {
  pokemon:  'bg-red-100 text-red-700',
  onepiece: 'bg-blue-100 text-blue-700',
  yugioh:   'bg-purple-100 text-purple-700',
  mtg:      'bg-amber-100 text-amber-700',
  other:    'bg-navy/10 text-navy/50',
};

async function fetchPopular(game?: string): Promise<Group[]> {
  try {
    const qs  = new URLSearchParams({ limit: '50' });
    if (game) qs.set('game', game);
    const res  = await fetch(`${BASE_URL}/api/v1/card-requests/popular?${qs.toString()}`, {
      next: { revalidate: 300 },
    });
    const json = await res.json() as { ok: boolean; groups?: Group[] };
    return json.ok && Array.isArray(json.groups) ? json.groups : [];
  } catch {
    return [];
  }
}

type Props = {
  params:       { locale: Locale };
  searchParams: { game?: string };
};

export default async function MostRequestedPage({ params, searchParams }: Props) {
  const isEn       = params.locale === 'en';
  const gameFilter = searchParams.game?.trim() || undefined;
  const groups     = await fetchPopular(gameFilter);
  const GAMES      = ['pokemon', 'onepiece', 'yugioh', 'mtg'];
  const gameLabel  = isEn ? GAME_LABEL_EN : GAME_LABEL_JA;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">

      {/* Hero */}
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-navy/40">Community Signal</p>
        <h1 className="text-3xl font-semibold text-navy">Most Requested Cards</h1>
        <p className="text-sm text-navy/60">
          {isEn
            ? 'Cards most requested by the community. A leading indicator of market demand.'
            : 'ユーザーが最も追加をリクエストしているカード。市場需要の先行指標です。'}
        </p>
      </header>

      {/* Game filter */}
      <div className="flex flex-wrap gap-2">
        <GamePill label={isEn ? 'All' : 'すべて'} href="/most-requested" active={!gameFilter} />
        {GAMES.map((g) => (
          <GamePill
            key={g}
            label={gameLabel[g] ?? g}
            href={`/most-requested?game=${g}`}
            active={gameFilter === g}
            game={g}
          />
        ))}
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="rounded border border-navy/10 bg-white p-8 text-center space-y-4">
          <p className="text-sm text-navy/50">
            {isEn ? 'No requests yet.' : 'まだリクエストはありません。'}
          </p>
          <p className="text-xs text-navy/40">
            {isEn ? 'Be the first to request a card!' : 'あなたが最初のリクエストを送りましょう！'}
          </p>
          <div className="flex justify-center">
            <CardRequestButton />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g, i) => (
            <RequestRow key={`${g.name}-${g.game ?? ''}-${i}`} group={g} rank={i + 1} gameLabel={gameLabel} isEn={isEn} />
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="rounded border border-navy/10 bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-navy">
            {isEn ? "Don't see your card?" : 'お探しのカードがない？'}
          </p>
          <p className="text-xs text-navy/50 mt-0.5">
            {isEn
              ? 'Submit a request — it will appear on this list.'
              : 'リクエストを送ると、このリストに表示されます。'}
          </p>
        </div>
        <CardRequestButton />
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-navy/35 text-center">
        {isEn ? (
          <>Requests are published as demand signals. Cards are added at curator discretion.{' '}
          <Link href="/terms" className="underline ml-1 hover:text-navy/60">Terms</Link></>
        ) : (
          <>リクエストは需要シグナルとして公開されます。追加はコレクター判断で行われます。
          <Link href="/terms" className="underline ml-1 hover:text-navy/60">利用規約</Link></>
        )}
      </p>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GamePill({ label, href, active, game }: { label: string; href: string; active: boolean; game?: string }) {
  const color = game ? GAME_COLOR[game] : '';
  return (
    <Link
      href={href}
      className={[
        'rounded-full border px-3 py-1 text-[11px] font-medium transition',
        active
          ? game
            ? `${color} border-transparent`
            : 'bg-navy text-white border-navy'
          : 'border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

function RequestRow({
  group, rank, gameLabel, isEn,
}: {
  group: Group; rank: number; gameLabel: Record<string, string>; isEn: boolean;
}) {
  const isHot  = group.count >= 5;
  const isWarm = group.count >= 3;

  return (
    <div className="flex items-center gap-4 rounded border border-navy/10 bg-white px-4 py-3 hover:bg-navy/[0.02] transition">
      <span className={[
        'w-7 shrink-0 text-center text-sm font-bold tabular-nums',
        rank === 1 ? 'text-amber-500' :
        rank === 2 ? 'text-navy/40' :
        rank === 3 ? 'text-amber-700/70' :
        'text-navy/25',
      ].join(' ')}>
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy truncate">{group.name}</p>
        {group.game && (
          <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${GAME_COLOR[group.game] ?? 'bg-navy/10 text-navy/50'}`}>
            {gameLabel[group.game] ?? group.game}
          </span>
        )}
      </div>

      <div className="shrink-0 text-right">
        <span className={[
          'inline-block rounded-full px-3 py-0.5 text-xs font-bold tabular-nums',
          isHot  ? 'bg-amber-100 text-amber-700' :
          isWarm ? 'bg-blue-100 text-blue-700' :
          'bg-navy/8 text-navy/50',
        ].join(' ')}>
          {group.count} {isEn ? 'req' : 'req'}
        </span>
        {isHot && (
          <p className="mt-0.5 text-[10px] text-amber-600 font-medium">
            {isEn ? '🔥 High demand' : '🔥 需要高'}
          </p>
        )}
      </div>
    </div>
  );
}
