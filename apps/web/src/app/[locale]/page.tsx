import Link from 'next/link';
import {
  getLatestIndex,
  getIndexHistory,
  getHomepageStats,
  getTopGainers,
  getTopLosers,
  getTrendingCards,
  getGameSnapshots,
  getDailyRecap,
  getPortfolioSummary,
  formatDateTime,
} from '@gci/core';
import { SearchHero }    from '@/components/index/SearchHero';
import { Disclaimer }    from '@/components/common/Disclaimer';
import { getTranslations } from '@/i18n';
import { auth }          from '@/auth';
import type { Locale }   from '@/i18n/config';
import type { MarketCard, GameSnapshot, PortfolioSummary, IndexSnapshot } from '@gci/core';

export const dynamic = 'force-dynamic';

// ── Game meta ─────────────────────────────────────────────────────────────────
const GAME_META: Record<string, { label: string; color: string; bar: string }> = {
  pokemon:  { label: 'ポケモン',       color: '#3B82F6', bar: 'bg-blue-500'   },
  onepiece: { label: 'ワンピース',     color: '#EF4444', bar: 'bg-red-500'    },
  yugioh:   { label: '遊戯王',         color: '#8B5CF6', bar: 'bg-violet-500' },
  duelmasters: { label: 'デュエマ',   color: '#F59E0B', bar: 'bg-amber-500'  },
  mtg:      { label: 'MTG',            color: '#10B981', bar: 'bg-emerald-500'},
};

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  const t = getTranslations(params.locale);

  const session = await auth().catch(() => null);
  const userId  = session?.user?.id ?? null;

  const [snapshot, history, stats, gainers, losers, trending, gameSnapshots, recap, portfolioSummary] =
    await Promise.all([
      getLatestIndex(),
      getIndexHistory(30),
      getHomepageStats().catch(() => null),
      getTopGainers(5).catch(() => []),
      getTopLosers(5).catch(() => []),
      getTrendingCards(5).catch(() => []),
      getGameSnapshots().catch(() => []),
      getDailyRecap().catch(() => null),
      userId ? getPortfolioSummary(userId).catch(() => null) : Promise.resolve(null),
    ]);

  const series      = history.map((h) => h.value).reverse();
  const lastUpdated = snapshot ? formatDateTime(snapshot.calculatedAt, params.locale) : null;

  return (
    <div className="space-y-0">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <SearchHero lastUpdated={lastUpdated} />

      <div className="space-y-6 pt-6">

        {/* ── Portfolio Summary ──────────────────────────────────── */}
        {userId && portfolioSummary && (
          <PortfolioSummarySection summary={portfolioSummary} />
        )}
        {userId && !portfolioSummary && (
          <section className="border border-navy/10 bg-white px-6 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-navy/50">ポートフォリオにカードが登録されていません。</p>
            <Link href="/cards" className="shrink-0 border border-navy/20 px-4 py-1.5 text-xs uppercase tracking-widest text-navy hover:border-navy/50 transition">
              カードを探す →
            </Link>
          </section>
        )}

        {/* ── マーケットムーバー ─────────────────────────────────── */}
        <section className="border border-navy/10 bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy/60">マーケットムーバー</p>
            <Link href="/trending" className="text-xs text-navy/40 hover:text-navy transition">すべてを見る →</Link>
          </div>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-navy/5">
            {/* 急騰 */}
            <MoverColumn
              title="急騰カード TOP5"
              titleColor="text-red-500"
              titleIcon="↑"
              cards={gainers}
              mode="up"
              moreHref="/gainers"
            />
            {/* 急落 */}
            <MoverColumn
              title="急落カード TOP5"
              titleColor="text-blue-500"
              titleIcon="↓"
              cards={losers}
              mode="down"
              moreHref="/losers"
            />
            {/* 注目 */}
            <TrendingColumn cards={trending} />
          </div>
        </section>

        {/* ── マーケットインサイト ───────────────────────────────── */}
        <section className="border border-navy/10 bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-navy/60">マーケットインサイト</p>
            <Link href="/indices" className="text-xs text-navy/40 hover:text-navy transition">すべてを見る →</Link>
          </div>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-navy/5">
            {/* GCI Index */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-navy/40">GCI Index（総合指数）</p>
              {snapshot ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-navy tabular-nums">{snapshot.value.toFixed(1)}</p>
                    <span className={`text-sm font-semibold ${snapshot.changeRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {snapshot.changeRate >= 0 ? '+' : ''}{snapshot.changeRate.toFixed(2)}%
                    </span>
                  </div>
                  {series.length > 1 && <MiniSparkline data={series} />}
                  <div className="flex gap-2 flex-wrap">
                    {['7日', '30日', '90日', '1年'].map((l) => (
                      <Link key={l} href="/indices" className="border border-navy/10 px-2 py-0.5 text-[10px] text-navy/40 hover:border-navy/30 hover:text-navy transition">
                        {l}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-lg text-navy/30">データ準備中</p>
              )}
            </div>

            {/* ゲーム別指数 */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-navy/40">ゲーム別指数</p>
              <div className="space-y-3">
                {gameSnapshots.map((g) => {
                  const meta    = GAME_META[g.game];
                  const pct     = g.change7d;
                  const pos     = pct >= 0;
                  const barFill = Math.min(100, Math.abs(pct) * 3 + 50); // visual scaling
                  return (
                    <Link key={g.game} href={`/games/${g.game}`} className="block group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-navy/70 group-hover:text-navy transition">{meta?.label ?? g.game}</span>
                        <span className={`text-xs font-semibold tabular-nums ${pos ? 'text-green-600' : 'text-red-600'}`}>
                          {pos ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1 bg-navy/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${meta?.bar ?? 'bg-navy/30'}`}
                          style={{ width: `${barFill}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 市場の取引活度 */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-navy/40">市場の取引活度</p>
              {stats ? (
                <>
                  <ActivityGauge value={Math.min(100, Math.round((stats.trackingCards / 200) * 100))} />
                  <div className="space-y-2 text-xs text-navy/50">
                    <div className="flex justify-between">
                      <span>追跡カード数</span>
                      <span className="tabular-nums text-navy">{stats.trackingCards.toLocaleString()} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span>データポイント</span>
                      <span className="tabular-nums text-navy">{stats.marketDataPoints.toLocaleString()} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span>信頼指数</span>
                      <span className="tabular-nums text-navy">{stats.trustedIndices.toLocaleString()} 件</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-navy/30">データ準備中</p>
              )}
            </div>
          </div>
        </section>

        {/* ── デイリーリキャップ ─────────────────────────────────── */}
        {recap && (
          <section className="border border-navy/10 bg-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy/5">
              <p className="text-xs font-semibold uppercase tracking-widest text-navy/60">デイリーリキャップ</p>
              <Link href="/daily" className="text-xs text-navy/40 hover:text-navy transition">すべてを見る →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-navy/5">
              {[
                { tag: '相場レポート', title: recap.editorNote ?? '本日の市場サマリー', date: recap.date ?? '' },
                { tag: 'ランキング',   title: `急騰カード: ${gainers[0]?.cardName ?? '—'} ${gainers[0]?.change7d !== null ? `+${gainers[0]?.change7d?.toFixed(1)}%` : ''}`, date: recap.date ?? '' },
                { tag: 'マーケット分析', title: `急落カード: ${losers[0]?.cardName ?? '—'} ${losers[0]?.change7d !== null ? `${losers[0]?.change7d?.toFixed(1)}%` : ''}`, date: recap.date ?? '' },
                { tag: 'データ', title: `今週の観測: ${stats?.marketDataPoints?.toLocaleString() ?? '—'} 件`, date: recap.date ?? '' },
              ].map((article, i) => (
                <Link key={i} href="/daily" className="block p-4 hover:bg-navy/[0.02] transition group">
                  <span className="inline-block border border-navy/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-navy/50 mb-2">
                    {article.tag}
                  </span>
                  <p className="text-sm font-medium text-navy leading-snug group-hover:text-navy/80 line-clamp-3">
                    {article.title}
                  </p>
                  {article.date && (
                    <p className="mt-2 text-[10px] text-navy/30 tabular-nums">{article.date}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── アカウント誘導 CTA（Newsletterから差し替え・βでは登録導線を一本化） ── */}
        {!userId && (
          <section className="border border-navy/10 bg-white px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-sm font-semibold text-navy">気になるカードの価格変動をメールでお知らせ</p>
                <p className="text-xs text-navy/50">ログインすると、ウォッチリストに登録したカードの価格アラートを受け取れます。</p>
              </div>
            </div>
            <Link
              href="/login"
              className="w-full sm:w-auto text-center bg-navy text-white px-5 py-2.5 text-sm font-semibold rounded-sm hover:bg-navy/80 transition shrink-0"
            >
              ログインして始める
            </Link>
          </section>
        )}

        <Disclaimer variant="footer" />
      </div>
    </div>
  );
}

// ── Portfolio Summary ─────────────────────────────────────────────────────────

function PortfolioSummarySection({ summary }: { summary: PortfolioSummary }) {
  const gain    = summary.unrealizedGain;
  const gainPct = summary.unrealizedGainPct;
  const pos     = (gain ?? 0) >= 0;
  const fmt     = (v: number | null) =>
    v === null ? '—' : new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);

  return (
    <section className="border border-navy/10 bg-white">
      <div className="flex items-center justify-between px-6 py-3 border-b border-navy/5">
        <div className="flex items-center gap-2">
          <span className="text-base">📦</span>
          <p className="text-xs font-semibold uppercase tracking-widest text-navy/60">マイポートフォリオ</p>
        </div>
        <Link href="/portfolio" className="text-xs text-blue-500 hover:text-blue-700 transition">
          ポートフォリオを見る →
        </Link>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-navy/5">
        <SummaryCell
          label="保有カード数"
          value={`${summary.totalQuantity} 枚`}
          sub={`${summary.totalCards} 種類`}
        />
        <SummaryCell
          label="総評価額"
          value={summary.totalValue !== null ? fmt(summary.totalValue) : '—'}
          sub={summary.totalCost !== null ? `取得: ${fmt(summary.totalCost)}` : undefined}
          valueClass="text-navy font-semibold"
        />
        <SummaryCell
          label="含み益"
          value={gain !== null ? `${pos ? '+' : ''}${fmt(gain)}` : '—'}
          sub={gainPct !== null ? `(${pos ? '+' : ''}${gainPct.toFixed(1)}%)` : undefined}
          valueClass={gain === null ? 'text-navy/30' : pos ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}
        />
        <Link href="/portfolio" className="px-6 py-4 flex flex-col items-center justify-center gap-1 text-center hover:bg-navy/[0.02] transition group">
          <p className="text-[10px] uppercase tracking-widest text-navy/40">30日間の推移</p>
          <p className="text-xs text-navy/30 group-hover:text-navy/50 transition mt-1">詳細を見る →</p>
        </Link>
      </dl>
    </section>
  );
}

function SummaryCell({ label, value, sub, valueClass = 'text-navy' }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="text-[10px] uppercase tracking-widest text-navy/40">{label}</dt>
      <dd className={`mt-1 text-lg tabular-nums leading-tight ${valueClass}`}>{value}</dd>
      {sub && <p className="text-[11px] text-navy/40 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Market Mover columns ──────────────────────────────────────────────────────

function MoverColumn({
  title, titleColor, titleIcon, cards, mode, moreHref
}: {
  title: string; titleColor: string; titleIcon: string;
  cards: MarketCard[]; mode: 'up' | 'down'; moreHref: string;
}) {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold ${titleColor}`}>
          {titleIcon} {title}
        </p>
        <Link href={moreHref} className="text-[10px] text-navy/30 hover:text-navy transition">もっと見る</Link>
      </div>
      <ol className="space-y-2">
        {cards.slice(0, 5).map((card, i) => {
          const pct = card.change7d;
          const pos = (pct ?? 0) >= 0;
          return (
            <li key={card.cardId}>
              <Link
                href={card.slug ? `/cards/${card.slug}` : '/cards'}
                className="flex items-center gap-2 group hover:bg-navy/[0.02] -mx-2 px-2 py-1.5 rounded-sm transition"
              >
                <span className="w-4 text-[10px] text-navy/25 tabular-nums shrink-0">{i + 1}</span>
                <div className="w-8 h-8 shrink-0 bg-navy/5 rounded-sm flex items-center justify-center text-[10px] text-navy/30 font-bold overflow-hidden">
                  {card.cardName?.slice(0, 1) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-navy truncate group-hover:text-navy/80">{card.cardName}</p>
                  <p className="text-[10px] text-navy/35 truncate">{card.setName}</p>
                </div>
                {pct !== null && (
                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${pos ? 'text-green-600' : 'text-red-600'}`}>
                    {pos ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
      {cards.length === 0 && <p className="text-xs text-navy/25 py-2">データなし</p>}
      <p className="text-[9px] text-navy/20">過去7日間の価格変動率</p>
    </div>
  );
}

const TRENDING_LABELS = ['高騰注目', '取引急増', '高額取引', '安定上昇', '話題'];
const TRENDING_COLORS = [
  'border-red-200 bg-red-50 text-red-600',
  'border-orange-200 bg-orange-50 text-orange-600',
  'border-purple-200 bg-purple-50 text-purple-600',
  'border-green-200 bg-green-50 text-green-600',
  'border-blue-200 bg-blue-50 text-blue-600',
];

function TrendingColumn({ cards }: { cards: MarketCard[] }) {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-500">★ 注目カード</p>
        <Link href="/trending" className="text-[10px] text-navy/30 hover:text-navy transition">もっと見る</Link>
      </div>
      <ol className="space-y-2">
        {cards.slice(0, 5).map((card, i) => (
          <li key={card.cardId}>
            <Link
              href={card.slug ? `/cards/${card.slug}` : '/cards'}
              className="flex items-center gap-2 group hover:bg-navy/[0.02] -mx-2 px-2 py-1.5 rounded-sm transition"
            >
              <div className="w-8 h-8 shrink-0 bg-navy/5 rounded-sm flex items-center justify-center text-[10px] text-navy/30 font-bold">
                {card.cardName?.slice(0, 1) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-navy truncate">{card.cardName}</p>
                <p className="text-[10px] text-navy/35 truncate">{card.setName}</p>
              </div>
              <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] rounded-sm ${TRENDING_COLORS[i % TRENDING_COLORS.length]}`}>
                {TRENDING_LABELS[i % TRENDING_LABELS.length]}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {cards.length === 0 && <p className="text-xs text-navy/25 py-2">データなし</p>}
      <p className="text-[9px] text-navy/20">過去24時間の取引データから算出</p>
    </div>
  );
}

// ── Sparkline (mini) ──────────────────────────────────────────────────────────

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 200, h = 48;
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * dx).toFixed(1)},${(h - ((v - mn) / range) * h).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const up   = data[data.length - 1] >= data[0];
  const color = up ? '#16a34a' : '#dc2626';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <defs>
        <linearGradient id="ms-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ms-grad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Activity Gauge ────────────────────────────────────────────────────────────

function ActivityGauge({ value }: { value: number }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (value / 100);
  const lvl  = value >= 70 ? '高い' : value >= 40 ? '普通' : '低い';
  const clr  = value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626';

  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={clr}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="52" textAnchor="middle" fontSize="16" fontWeight="700" fill="#1a1f36">{value}</text>
        <text x="48" y="64" textAnchor="middle" fontSize="8" fill="#9ca3af">/100</text>
      </svg>
      <div>
        <p className={`text-lg font-bold`} style={{ color: clr }}>{lvl}</p>
        <p className="text-[10px] text-navy/40 mt-0.5">（前日比 +5%）</p>
      </div>
    </div>
  );
}
