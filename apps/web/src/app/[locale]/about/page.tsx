import type { Metadata }  from 'next';
import Link               from 'next/link';
import { getTranslations } from '@/i18n';
import type { Locale }    from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const locale = params.locale;
  if (locale === 'en') {
    return {
      title:       'About GCI — Trading Card Prices, Trends & Market Index',
      description: 'Global Card Index (GCI) aggregates real sale data from major marketplaces to provide card price estimates, price trends, portfolio tracking, and a market-wide index.',
      robots:      { index: true, follow: true },
    };
  }
  return {
    title:       'GCIとは — トレカ相場と市場指数のプラットフォーム',
    description: 'Global Card Index（GCI）は複数マーケットの実売データを集約し、カードごとの推定相場・価格推移・保有カード管理、そして市場全体の指数を提供するプラットフォームです。',
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
            <>GCI is a <strong className="font-semibold text-navy">market data platform</strong> for trading cards. We aggregate and clean real sale data from multiple marketplaces, so you can check <strong className="font-semibold text-navy">estimated prices, trends, and your own portfolio</strong> — plus the pulse of the whole market — in one place.</>
          ) : (
            <>GCI はトレーディングカードの<strong className="font-semibold text-navy">相場データプラットフォーム</strong>です。<br />複数マーケットに点在する実売データを集約・クリーニングし、カードごとの<strong className="font-semibold text-navy">推定相場・価格推移・保有カードの評価額</strong>、そして市場全体の動きを一箇所で確認できます。</>
          )}
        </p>
      </header>

      {/* Section 1 */}
      <Section title={a.s1Title}>
        {isEn ? (
          <>
            <p>To figure out what a card is really worth today, you have to hop between marketplaces and compare listings one by one — with bait listings and outliers mixed in, it&apos;s hard to tell which price is the real market rate.</p>
            <p>GCI aggregates real sale data from multiple marketplaces, removes outliers, and presents it as a single <strong className="font-medium text-navy">estimated market price (low / median / high)</strong> with a price trend chart for each card.</p>
            <p>On top of that, we condense the entire market into one index (GCI), so you can also see <strong className="font-medium text-navy">whether the market as a whole is heating up or cooling down</strong>.</p>
            <Callout>Per-card prices and the temperature of the whole market — both in one place.</Callout>
          </>
        ) : (
          <>
            <p>「このカード、今いくらが相場なのか」を知るには、複数のマーケットを行き来して出品を1件ずつ見比べるしかありません。釣り出品や外れ値も混ざっていて、どれが本当の相場なのか分からない——それが現状です。</p>
            <p>GCI は複数マーケットの実売データを集約し、外れ値を取り除いたうえで、カードごとに<strong className="font-medium text-navy">推定相場（最安値・中央値・最高値）と価格推移</strong>として提示します。</p>
            <p>さらに市場全体の動きを一本の指数（GCI）に集約し、<strong className="font-medium text-navy">「今、市場全体は熱いのか冷えているのか」</strong>も見えるようにしています。</p>
            <Callout>個別カードの相場と、市場全体の体温。その両方を1つの場所で。</Callout>
          </>
        )}
      </Section>

      {/* Section 2 */}
      <Section title={a.s2Title}>
        {isEn ? (
          <>
            <p>GCI turns raw listings into market data through a 4-stage pipeline.</p>
            <ol className="mt-4 space-y-5">
              {[
                { n: '1', title: 'Collection',     body: 'We collect transaction data from multiple secondary markets, referencing both active and sold listings, prioritizing actual completed transactions.' },
                { n: '2', title: 'Filtering',      body: 'Lot sales, suspected counterfeits, and unknown-condition listings are automatically excluded. Graded cards (PSA etc.) are tracked separately by condition. IQR outlier detection then removes anomalies that distort the market.' },
                { n: '3', title: 'Price & Index Calculation', body: 'From the cleaned data we derive each card\'s estimated market price (low / median / high) and price history. A TrustScore-weighted average (source reliability, listing type, condition) also feeds the market index with base value 1000.' },
                { n: '4', title: 'Confidence Scoring', body: 'HIGH / MED / LOW confidence is derived from sample count and outlier ratio, published alongside the data. Values with insufficient data are hidden or marked as reference values.' },
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
            <p>GCI は4段階のパイプラインで、生の出品データを相場情報に変えています。</p>
            <ol className="mt-4 space-y-5">
              {[
                { n: '1', title: '収集',       body: '複数の二次市場から取引データを収集します。販売中リスト・販売済みリストの両方を参照し、実際に成立した取引を優先します。' },
                { n: '2', title: 'フィルタリング', body: 'まとめ売り・偽造品疑い・コンディション不明の出品を自動除外します。鑑定品（PSA等）は別コンディションとして分離して追跡します。さらに IQR（四分位範囲）で外れ値検出を行い、相場を歪める釣り出品・異常値を取り除きます。' },
                { n: '3', title: '相場・指数の算出', body: 'クリーンになったデータから、カードごとの推定相場（最安値・中央値・最高値）と価格推移を算出します。あわせて TrustScore（ソース信頼性・出品形態・コンディション）で重み付けした加重平均から、基準値 1000 の市場指数を計算します。' },
                { n: '4', title: '信頼度付与',   body: 'サンプル数と外れ値率から HIGH / MED / LOW の信頼度を算出し、データとともに公開します。データが不足している場合は非表示にするか、参考値として明示します。' },
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
              <AudienceCard icon="🃏" title="Collectors"     body="Check estimated prices and trends to judge when to buy or sell. Add cards to your watchlist and get email alerts on big price moves." />
              <AudienceCard icon="📊" title="My Cards" body="Register the cards you own and GCI automatically tracks their total value and unrealized gains against the latest market prices." />
              <AudienceCard icon="🏪" title="Card Shops"     body="Reference data for setting buy prices. Verify deviation from market rates numerically, supporting fair price formation." />
            </>
          ) : (
            <>
              <AudienceCard icon="🃏" title="コレクター"     body="推定相場と価格推移で「買い時・売り時」を判断。気になるカードはウォッチリストに入れておけば、大きな価格変動をメールでお知らせします。" />
              <AudienceCard icon="📊" title="保有カード管理"  body="持っているカードを マイカード に登録すると、最新相場に基づく評価額と含み損益を自動で追跡できます。" />
              <AudienceCard icon="🏪" title="カードショップ" body="買取価格設定の参考データとして。市場相場との乖離を数値で確認し、適正な価格形成を支援します。" />
            </>
          )}
        </div>
      </Section>

      {/* Section 4 */}
      <Section title={a.s4Title}>
        <div className="space-y-3 text-sm text-navy/70 leading-relaxed">
          {isEn ? (
            <>
              <NotItem><strong className="text-navy">Not a marketplace.</strong> You cannot buy or sell cards on GCI. Actual transactions happen on external marketplaces — our prices are reference aggregates.</NotItem>
              <NotItem><strong className="text-navy">Not investment advice.</strong> Estimated prices and index values do not constitute trading recommendations. Decisions based on this data are solely your responsibility.</NotItem>
              <NotItem><strong className="text-navy">Not exchange-grade real-time data.</strong> Price data is collected periodically throughout the day and aggregates are recalculated regularly. Sudden moves may take time to appear.</NotItem>
            </>
          ) : (
            <>
              <NotItem><strong className="text-navy">売買の場ではありません。</strong>GCI 上でカードの売買はできません。実際の取引は各外部マーケットで行われ、掲載する相場は参考集計です。</NotItem>
              <NotItem><strong className="text-navy">投資助言ではありません。</strong>推定相場・指数値は売買推奨を構成しません。掲載情報を参考にした取引の判断は、利用者ご自身の責任において行ってください。</NotItem>
              <NotItem><strong className="text-navy">取引所レベルのリアルタイムではありません。</strong>価格データは1日を通して定期的に収集し、集計は定期的に再計算されます。急な変動の反映には時間差があります。</NotItem>
            </>
          )}
        </div>
      </Section>

      {/* Section 5 — Roadmap */}
      <Section title={a.s5Title}>
        <div className="space-y-3">
          {isEn ? (
            [
              { phase: 'Now',    items: ['Estimated prices (low / median / high) & trend charts', 'My Cards tracking (value & unrealized gains)', 'Watchlist & price alerts', 'Daily market summaries & market index'] },
              { phase: 'Soon',   items: ['More games (Yu-Gi-Oh! / MTG expansion)', 'More data sources', 'Set-level aggregates'] },
              { phase: 'Future', items: ['PSA/BGS grade-level analytics', 'Game-level sub-indices', 'Developer API'] },
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
              { phase: '現在',  items: ['推定相場（最安/中央/最高）と価格推移チャート', 'マイカード（評価額・含み損益の自動追跡）', 'ウォッチリストと価格変動アラート', '日次市場サマリーと市場指数'] },
              { phase: '近日',  items: ['対応ゲーム拡充（遊戯王・MTG強化）', 'データソースの拡充', 'セット別の相場集計'] },
              { phase: '将来',  items: ['PSA/BGS グレード別の相場分析', 'ゲーム別サブ指数', '開発者向け API'] },
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
