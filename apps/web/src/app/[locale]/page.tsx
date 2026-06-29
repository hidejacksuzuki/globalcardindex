import Link                       from 'next/link';
import {
  getLatestIndex,
  getIndexHistory,
  getHomepageStats,
  getTopGainers,
  getGameSnapshots,
  getDailyRecap,
  getPortfolioSummary,
} from '@gci/core';
import { IndexHero }              from '@/components/index/IndexHero';
import { SearchHero }             from '@/components/index/SearchHero';
import { Disclaimer, ConfidenceExplainer } from '@/components/common/Disclaimer';
import { SubscribeForm }          from '@/components/newsletter/SubscribeForm';
import { getTranslations }        from '@/i18n';
import { auth }                   from '@/auth';
import type { Locale }            from '@/i18n/config';
import type { MarketCard, GameSnapshot, PortfolioSummary } from '@gci/core';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  const t = getTranslations(params.locale);
  const h = t.home;

  const session = await auth();
  const userId  = session?.user?.id ?? null;

  const [snapshot, history, stats, gainers, gameSnapshots, recap, portfolioSummary] = await Promise.all([
    getLatestIndex(),
    getIndexHistory(30),
    getHomepageStats().catch(() => null),
    getTopGainers(5).catch(() => []),
    getGameSnapshots().catch(() => []),
    getDailyRecap().catch(() => null),
    userId ? getPortfolioSummary(userId).catch(() => null) : Promise.resolve(null),
  ]);

  const series = history.map((h) => h.value).reverse();

  return (
    <div className="space-y-8">

      {/* ── Search Hero ────────────────────────────────────────── */}
      <SearchHero />

      {/* ── Portfolio Summary (ログイン済みのみ) ─────────────── */}
      {userId && portfolioSummary && portfolioSummary.totalCards > 0 && (
        <PortfolioSummarySection summary={portfolioSummary} />
      )}
      {userId && portfolioSummary && portfolioSummary.totalCards === 0 && (
        <section className="border border-navy/10 bg-white px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-navy/50">ポートフォリオにカードが登録されていません。</p>
          <Link
            href="/cards"
            className="shrink-0 border border-navy/20 px-4 py-1.5 text-xs uppercase tracking-widest text-navy hover:border-navy/50 transition"
          >
            カードを探す →
          </Link>
        </section>
      )}

      {/* ── Beta badge ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700">
          {t.home.betaBadge}
        </span>
        <span className="text-xs text-navy/40">{t.home.betaNote}</span>
      </div>

      {/* ── Top Movers ─────────────────────────────────────────── */}
      {gainers.length > 0 && (
        <section className="border border-navy/10 bg-white p-8 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-navy/50">{h.topMoversTitle}</p>
            <Link href="/trending" className="text-xs text-navy/50 hover:text-navy transition">
              {h.topMoversAll} →
            </Link>
          </div>
          <ol className="space-y-3">
            {gainers.map((card, i) => (
              <TopMoverRow key={card.cardId} rank={i + 1} card={card} />
            ))}
          </ol>
        </section>
      )}

      {/* ── Market Snapshot (game-level changes) ───────────────── */}
      {gameSnapshots.length > 0 && (
        <section className="border border-navy/10 bg-white p-8">
          <p className="text-xs uppercase tracking-widest text-navy/50 mb-5">{h.marketSnapshotTitle}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {gameSnapshots.map((g) => (
              <GameSnapshotCard key={g.game} snapshot={g} />
            ))}
          </div>
        </section>
      )}

      {/* ── Daily Market Recap ─────────────────────────────────── */}
      {recap && (
        <section className="border border-navy/10 bg-white p-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-xs uppercase tracking-widest text-navy/50">{h.dailyRecapTitle}</p>
            <p className="text-sm text-navy/80 leading-relaxed max-w-2xl">{recap.editorNote}</p>
          </div>
          <Link
            href="/daily"
            className="shrink-0 self-start border border-navy/20 px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-navy hover:border-navy/50 hover:bg-navy/5 transition whitespace-nowrap"
          >
            {h.dailyRecapCta} →
          </Link>
        </section>
      )}

      {/* ── Market Insights (GCI Index) ────────────────────────── */}
      <section className="border border-navy/10 bg-white p-8 space-y-6">
        <p className="text-xs uppercase tracking-widest text-navy/50">Market Insights</p>
        <IndexHero
          snapshot={snapshot}
          series={series}
          locale={params.locale}
          stats={stats ?? undefined}
        />
      </section>

      {/* ── Navigation cards ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard href="/marketboard" label="Marketboard"   desc={h.nav.marketboardDesc} badge={h.nav.marketboardBadge} />
        <NavCard href="/cards"       label="Cards"         desc={h.nav.cardsDesc}       badge={h.nav.cardsBadge}       />
        <NavCard href="/portfolio"   label="Portfolio"     desc={h.nav.portfolioDesc}   badge={h.nav.portfolioBadge}   />
        <NavCard href="/games"       label="Games"         desc={h.nav.gamesDesc}       badge={h.nav.gamesBadge}       />
        <NavCard href="/daily"       label="Daily Recap"   desc={h.nav.dailyDesc}       badge={h.nav.dailyBadge}       />
        <NavCard href="/newsletter"  label="Newsletter"    desc={h.nav.newsletterDesc}  badge={h.nav.newsletterBadge}  />
      </section>

      {/* ── Why GCI ────────────────────────────────────────────── */}
      <section className="border border-navy/10 bg-white p-8 space-y-4">
        <p className="text-xs uppercase tracking-widest text-navy/50">{h.whyGciTitle}</p>
        <p className="text-sm text-navy/70 leading-relaxed max-w-2xl">{h.whyGciBody}</p>
        <Link
          href="/about"
          className="inline-block border border-navy/20 px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-navy hover:border-navy/50 hover:bg-navy/5 transition"
        >
          {h.whyGciCta} →
        </Link>
      </section>

      {/* ── Data Transparency ──────────────────────────────────── */}
      <section className="border border-navy/10 bg-white p-8 space-y-5">
        <p className="text-xs uppercase tracking-widest text-navy/50">{h.dataTransTitle}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DataTransCard icon="⚡" label={h.dataTrans1Label} body={h.dataTrans1Body} />
          <DataTransCard icon="✂️" label={h.dataTrans2Label} body={h.dataTrans2Body} />
          <DataTransCard icon="📊" label={h.dataTrans3Label} body={h.dataTrans3Body} />
          <DataTransCard icon="🔢" label={h.dataTrans4Label} body={h.dataTrans4Body} />
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────────────────── */}
      <section className="border border-navy bg-navy p-8 sm:p-10 space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">{h.footerCtaTitle}</p>
          <p className="text-lg font-semibold text-white">{h.footerCtaBody}</p>
        </div>
        <div className="max-w-sm">
          <SubscribeForm />
        </div>
        {process.env.NEXT_PUBLIC_TWITTER_URL && (
          <a
            href={process.env.NEXT_PUBLIC_TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white transition"
          >
            𝕏 {h.footerCtaX}
          </a>
        )}
      </section>

      <ConfidenceExplainer />
      <Disclaimer variant="banner" />
    </div>
  );
}

// ── Portfolio Summary Section ─────────────────────────────────────────────────

function PortfolioSummarySection({ summary }: { summary: PortfolioSummary }) {
  const gain    = summary.unrealizedGain;
  const gainPct = summary.unrealizedGainPct;
  const positive = (gain ?? 0) >= 0;

  const fmt = (val: number | null) =>
    val === null ? '—' : new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(val);

  return (
    <section className="border border-navy/10 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-navy/40">My Portfolio</p>
        <Link href="/portfolio" className="text-xs text-navy/40 hover:text-navy transition underline underline-offset-2">
          詳細を見る →
        </Link>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">保有カード</dt>
          <dd className="mt-1 text-lg font-semibold text-navy tabular-nums">{summary.totalCards}種</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">総評価額</dt>
          <dd className="mt-1 text-lg font-semibold text-navy tabular-nums">
            {summary.totalValue !== null ? fmt(summary.totalValue) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">取得コスト</dt>
          <dd className="mt-1 text-lg tabular-nums text-navy/60">
            {summary.totalCost !== null ? fmt(summary.totalCost) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">含み損益</dt>
          <dd className={`mt-1 text-lg font-semibold tabular-nums ${
            gain === null ? 'text-navy/30' : positive ? 'text-green-700' : 'text-red-600'
          }`}>
            {gain !== null ? (
              <>
                {positive ? '+' : ''}{fmt(gain)}
                {gainPct !== null && (
                  <span className="ml-1 text-sm font-normal">
                    ({positive ? '+' : ''}{gainPct.toFixed(1)}%)
                  </span>
                )}
              </>
            ) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GameSnapshotCard({ snapshot }: { snapshot: GameSnapshot }) {
  const positive = snapshot.change7d >= 0;
  const nameMap: Record<string, string> = { pokemon: 'Pokemon', onepiece: 'One Piece', yugioh: 'Yu-Gi-Oh', mtg: 'Magic' };
  return (
    <Link
      href={`/games/${snapshot.game}`}
      className="block border border-navy/8 p-4 space-y-1 hover:border-navy/20 hover:bg-navy/[0.02] transition"
    >
      <p className="text-xs font-medium text-navy/70">{nameMap[snapshot.game] ?? snapshot.game}</p>
      <p className={`text-lg font-semibold tabular-nums ${positive ? 'text-gold-700' : 'text-red-700'}`}>
        {positive ? '+' : ''}{snapshot.change7d.toFixed(1)}%
      </p>
      <p className="text-[10px] text-navy/30 uppercase tracking-widest">7d avg</p>
    </Link>
  );
}

function TopMoverRow({ rank, card }: { rank: number; card: MarketCard }) {
  const positive = (card.change7d ?? 0) >= 0;
  const href = card.slug ? `/cards/${card.slug}` : '/cards';
  return (
    <li>
      <Link href={href} className="flex items-center gap-4 group hover:bg-navy/2 -mx-2 px-2 py-1.5 rounded transition">
        <span className="w-5 text-right text-xs text-navy/30 tabular-nums shrink-0">{rank}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-navy truncate">{card.cardName}</span>
          <span className="block text-[11px] text-navy/40 truncate">{card.setName}</span>
        </span>
        {card.change7d !== null && (
          <span className={`text-sm font-semibold tabular-nums shrink-0 ${positive ? 'text-gold-700' : 'text-red-700'}`}>
            {positive ? '+' : ''}{card.change7d.toFixed(1)}%
          </span>
        )}
      </Link>
    </li>
  );
}

function DataTransCard({ icon, label, body }: { icon: string; label: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xl">{icon}</p>
      <p className="text-xs font-semibold uppercase tracking-widest text-navy/70">{label}</p>
      <p className="text-sm text-navy/55 leading-relaxed">{body}</p>
    </div>
  );
}

function NavCard({ href, label, desc, badge }: { href: string; label: string; desc: string; badge: string }) {
  return (
    <Link href={href} className="group border border-navy/10 bg-white p-6 transition hover:border-navy/30 hover:shadow-sm">
      <p className="text-[10px] uppercase tracking-widest text-navy/40 mb-2">{badge}</p>
      <p className="text-base font-semibold text-navy group-hover:text-navy transition">{label} →</p>
      <p className="mt-1.5 text-sm text-navy/55 leading-relaxed">{desc}</p>
    </Link>
  );
}
