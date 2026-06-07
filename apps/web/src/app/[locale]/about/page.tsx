import type { Metadata }  from 'next';
import Link               from 'next/link';
import { getTranslations } from '@/i18n';
import type { Locale }    from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const locale = params.locale;
  if (locale === 'en') {
    return {
      title:       'About GCI — Trading Card Market Index Infrastructure',
      description: 'Global Card Index (GCI) is trading card market index infrastructure. Like the Nikkei for stocks — a trusted benchmark for the TCG market.',
      robots:      { index: true, follow: true },
    };
  }
  return {
    title:       'GCIとは — カード市場指数インフラ',
    description: 'Global Card Index（GCI）はトレーディングカード市場の指数インフラです。',
    robots:      { index: true, follow: true },
  };
}

export default function AboutPage({ params }: { params: { locale: Locale } }) {
  const t = getTranslations(params.locale);
  const a = t.about;
  const isEn = params.locale === 'en';

  return (
    <div className="mx-auto max-w-2xl space-y-16 py-4">

      {/* Breadcrumb */}
      <nav className="text-xs uppercase tracking-widest text-navy/40">
        <Link href="/" className="hover:text-navy transition">{a.breadcrumb}</Link>
        <span className="mx-2">/</span>
        <span>About</span>
      </nav>

      {/* Hero */}
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-gold-600">{a.tagline}</p>
        <h1 className="text-3xl font-semibold leading-tight text-navy">{a.heroTitle}</h1>
        <p className="text-base text-navy/60 leading-relaxed">
          {isEn ? (
            <>GCI is not a trading card <strong className="font-semibold text-navy">price lookup site</strong>. It&apos;s <strong className="font-semibold text-navy">index infrastructure</strong> that reflects the entire market.</>
          ) : (
            <>GCI はトレーディングカードの「価格サイト」ではありません。<br />市場全体を映す<strong className="font-semibold text-navy">指数インフラ</strong>です。</>
          )}
        </p>
      </header>

      {/* Section 1 */}
      <Section title={a.s1Title}>
        {isEn ? (
          <>
            <p>The stock market has the S&amp;P 500. Forex has USD/JPY. But trading cards?</p>
            <p>Today, to understand card prices you have to search individual external marketplaces or check specific shop buy prices. That&apos;s &ldquo;point&rdquo; data — there&apos;s no &ldquo;line&rdquo; showing the overall market trend.</p>
            <p>The result: <strong className="font-medium text-navy">no one can objectively say whether the market is rising or falling</strong>. That&apos;s the fundamental opacity of the TCG market.</p>
            <Callout>GCI exists to resolve that opacity — measuring the overall temperature of the market, not individual prices.</Callout>
          </>
        ) : (
          <>
            <p>株式市場には日経平均がある。為替市場には USD/JPY がある。では、トレーディングカード市場には？</p>
            <p>現状、カード相場を知るには個別に外部マーケットを検索するか、特定ショップの買取価格を参照するしかありません。それらは「点」の情報であり、市場全体の動向を示す「線」がありません。</p>
            <p>結果として、<strong className="font-medium text-navy">「今、市場は上昇しているのか、下落しているのか」</strong>を客観的に判断できる人間が存在しない。これがカード市場の根本的な不透明性です。</p>
            <Callout>GCI はその不透明性を解消するためのインフラです。個別価格ではなく、市場全体の体温を測ることを目的としています。</Callout>
          </>
        )}
      </Section>

      {/* Section 2 */}
      <Section title={a.s2Title}>
        {isEn ? (
          <>
            <p>GCI calculates indices through a 4-stage pipeline.</p>
            <ol className="mt-4 space-y-5">
              {[
                { n: '1', title: 'Collection',     body: 'We collect transaction data from multiple secondary markets, referencing both active listings and sold listings, prioritizing actual completed transactions.' },
                { n: '2', title: 'Filtering',      body: 'PSA-graded cards, lot sales, counterfeits, and unknown-condition listings are automatically excluded. Remaining data is cleaned with IQR outlier detection to remove anomalies that distort the market.' },
                { n: '3', title: 'Index Calculation', body: 'A TrustScore-weighted average (source reliability, listing type, condition) is calculated on the clean data, expressed as an index with base value 1000.' },
                { n: '4', title: 'Confidence Scoring', body: 'HIGH / MED / LOW confidence is derived from sample count and outlier ratio, published alongside the index value. Indices with insufficient data are hidden and marked as reference values.' },
              ].map(({ n, title, body }) => (
                <li key={n} className="flex gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
                  <div>
                    <p className="font-semibold text-navy">{title}</p>
                    <p className="mt-1 text-sm text-navy/65 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <p>GCI は4段階のパイプラインで指数を算出します。</p>
            <ol className="mt-4 space-y-5">
              {[
                { n: '1', title: '収集',       body: '複数の二次市場から取引データを収集します。販売中リスト・販売済みリストの両方を参照し、実際に成立した取引を優先します。' },
                { n: '2', title: 'フィルタリング', body: 'PSA鑑定品・まとめ売り・偽造品・コンディション不明のリストを自動除外します。残ったデータに IQR（四分位範囲）で外れ値検出を行い、相場を歪める異常値を取り除きます。' },
                { n: '3', title: '指数計算',    body: 'クリーンになったデータに対し、TrustScore（ソース信頼性・出品形態・コンディション）で重み付けした加重平均を計算します。結果は基準値 1000 のインデックスとして表現されます。' },
                { n: '4', title: '信頼度付与',   body: 'サンプル数と外れ値率から HIGH / MED / LOW の信頼度を算出し、指数値とともに公開します。データが不足している場合は指数値を非表示にし、参考値として明示します。' },
              ].map(({ n, title, body }) => (
                <li key={n} className="flex gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
                  <div>
                    <p className="font-semibold text-navy">{title}</p>
                    <p className="mt-1 text-sm text-navy/65 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>

      {/* Section 3 */}
      <Section title={a.s3Title}>
        <div className="grid gap-4 sm:grid-cols-3">
          {isEn ? (
            <>
              <AudienceCard icon="🃏" title="Collectors"     body="Objectively assess your collection's current market value. Understand whether it's a good time to buy or sell in the context of the overall market." />
              <AudienceCard icon="📊" title="TCG Investors"  body="Track indices for entire games and sets, not just individual cards. Provides numbers useful for portfolio management." />
              <AudienceCard icon="🏪" title="Card Shops"     body="Reference index for setting buy prices. Verify deviation from market rates numerically, supporting fair price formation." />
            </>
          ) : (
            <>
              <AudienceCard icon="🃏" title="コレクター"     body="手持ちカードの現在価値を客観的に把握。「買い時か、売り時か」を市場全体の文脈で判断できます。" />
              <AudienceCard icon="📊" title="TCG投資家"    body="個別カードだけでなく、ゲーム全体・セット全体の指数推移を追跡。ポートフォリオ管理に使える数字を提供します。" />
              <AudienceCard icon="🏪" title="カードショップ" body="買取価格設定の参考指標として。市場相場との乖離を数値で確認し、適正な価格形成を支援します。" />
            </>
          )}
        </div>
      </Section>

      {/* Section 4 */}
      <Section title={a.s4Title}>
        <div className="space-y-3 text-sm text-navy/70 leading-relaxed">
          {isEn ? (
            <>
              <NotItem><strong className="text-navy">Not a price lookup site.</strong> GCI does not tell you what a card costs to buy today. Actual transactions happen on external marketplaces.</NotItem>
              <NotItem><strong className="text-navy">Not investment advice.</strong> GCI index values do not constitute trading recommendations. Decisions based on this data are solely your responsibility.</NotItem>
              <NotItem><strong className="text-navy">Not real-time data.</strong> Indices are currently updated nightly. Intraday spikes will be reflected in the next day&apos;s update.</NotItem>
            </>
          ) : (
            <>
              <NotItem><strong className="text-navy">価格サイトではありません。</strong>「このカードが今いくらで買えるか」を教えるサービスではありません。実際の取引は各外部マーケットで行われます。</NotItem>
              <NotItem><strong className="text-navy">投資助言ではありません。</strong>GCI の指数値は売買推奨を構成しません。掲載情報を参考にした取引の判断は、利用者ご自身の責任において行ってください。</NotItem>
              <NotItem><strong className="text-navy">リアルタイムデータではありません。</strong>指数は現在、毎日夜間に更新されます。日中の急騰・急落は翌日の更新に反映されます。</NotItem>
            </>
          )}
        </div>
      </Section>

      {/* Section 5 — Roadmap */}
      <Section title={a.s5Title}>
        <div className="space-y-3">
          {isEn ? (
            [
              { phase: 'Now',    items: ['Pokémon / One Piece indices', 'Per-card confidence levels', 'Daily market summaries', 'Marketboard & Watchlist'] },
              { phase: 'Soon',   items: ['Yu-Gi-Oh! / MTG support', 'Multiple data sources (TCGPlayer etc.)', 'Set-level indices', 'Email/Discord alert notifications'] },
              { phase: 'Future', items: ['PSA/BGS grade-level indices', 'Game-level sub-indices', 'Portfolio tracking', 'Developer API v2'] },
            ].map(({ phase, items }) => (
              <div key={phase} className="flex gap-4">
                <span className="mt-0.5 w-14 shrink-0 text-[10px] uppercase tracking-widest text-navy/40 pt-0.5">{phase}</span>
                <ul className="flex-1 space-y-1">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-navy/70">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-500" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            [
              { phase: '現在',  items: ['ポケカ・ワンピ指数', 'カード別信頼度', '毎日の市場サマリー', 'Marketboard・Watchlist'] },
              { phase: '近日',  items: ['遊戯王・MTG対応', '複数データソース（TCGPlayer等）', 'セット別指数', 'メール/Discord アラート通知'] },
              { phase: '将来',  items: ['PSA/BGS グレード別指数', 'ゲーム別サブ指数', 'ポートフォリオ追跡', '開発者向け API v2'] },
            ].map(({ phase, items }) => (
              <div key={phase} className="flex gap-4">
                <span className="mt-0.5 w-14 shrink-0 text-[10px] uppercase tracking-widest text-navy/40 pt-0.5">{phase}</span>
                <ul className="flex-1 space-y-1">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-navy/70">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-500" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </Section>

      {/* CTA */}
      <div className="border-t border-navy/10 pt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">{a.ctaTitle}</p>
          <p className="mt-1 text-xs text-navy/50">{a.ctaDesc}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/beta" className="rounded border border-navy bg-navy px-5 py-2 text-xs font-medium text-white transition hover:bg-navy-950">
            {a.ctaBeta}
          </Link>
          <Link href="/" className="rounded border border-navy/20 px-5 py-2 text-xs font-medium text-navy/70 transition hover:border-navy/40 hover:text-navy">
            {a.ctaSite}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-navy border-b border-navy/8 pb-3">{title}</h2>
      <div className="space-y-3 text-sm text-navy/70 leading-relaxed">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border-l-2 border-gold-400 bg-gold-50 pl-4 pr-3 py-3 text-sm text-navy/80 leading-relaxed">
      {children}
    </div>
  );
}

function NotItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-red-400 text-xs">✕</span>
      <p>{children}</p>
    </div>
  );
}

function AudienceCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded border border-navy/10 bg-white p-4 space-y-2">
      <p className="text-2xl">{icon}</p>
      <p className="font-semibold text-navy text-sm">{title}</p>
      <p className="text-xs text-navy/60 leading-relaxed">{body}</p>
    </div>
  );
}
