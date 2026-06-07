import Link                       from 'next/link';
import { getLatestIndex, getIndexHistory } from '@gci/core';
import { IndexHero }              from '@/components/index/IndexHero';
import { Disclaimer, ConfidenceExplainer } from '@/components/common/Disclaimer';
import { getTranslations }        from '@/i18n';
import type { Locale }            from '@/i18n/config';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  const t = getTranslations(params.locale);

  const [snapshot, history] = await Promise.all([
    getLatestIndex(),
    getIndexHistory(30),
  ]);

  const series = history.map((h) => h.value).reverse();

  return (
    <div className="space-y-10">

      {/* ── Beta badge ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700">
          {t.home.betaBadge}
        </span>
        <span className="text-xs text-navy/40">{t.home.betaNote}</span>
      </div>

      {/* ── GCI Index Hero ─────────────────────────────────────── */}
      <IndexHero snapshot={snapshot} series={series} locale={params.locale} />

      {/* ── What is GCI ────────────────────────────────────────── */}
      <section className="border border-navy/10 bg-white p-8 space-y-5">
        <h2 className="text-xs uppercase tracking-widest text-navy/50">{t.home.whatIsGci}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <AboutCard icon="📊" title={t.home.feature1Title} body={t.home.feature1Body} />
          <AboutCard icon="🃏" title={t.home.feature2Title} body={t.home.feature2Body} />
          <AboutCard icon="🔍" title={t.home.feature3Title} body={t.home.feature3Body} />
        </div>
      </section>

      {/* ── Confidence explainer ───────────────────────────────── */}
      <ConfidenceExplainer />

      {/* ── Navigation cards ───────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard href="/marketboard" label="Marketboard"   desc={t.home.nav.marketboardDesc} badge={t.home.nav.marketboardBadge} />
        <NavCard href="/cards"       label="Cards"         desc={t.home.nav.cardsDesc}       badge={t.home.nav.cardsBadge}       />
        <NavCard href="/games"       label="Games"         desc={t.home.nav.gamesDesc}       badge={t.home.nav.gamesBadge}       />
        <NavCard href="/daily"       label="Daily Recap"   desc={t.home.nav.dailyDesc}       badge={t.home.nav.dailyBadge}       />
        <NavCard href="/indices"     label="Index History" desc={t.home.nav.indicesDesc}     badge={t.home.nav.indicesBadge}     />
        <NavCard href="/newsletter"  label="Newsletter"    desc={t.home.nav.newsletterDesc}  badge={t.home.nav.newsletterBadge}  />
      </section>

      {/* ── Disclaimer ─────────────────────────────────────────── */}
      <Disclaimer variant="banner" />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AboutCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-2xl">{icon}</p>
      <p className="font-medium text-navy">{title}</p>
      <p className="text-sm text-navy/60 leading-relaxed">{body}</p>
    </div>
  );
}

function NavCard({ href, label, desc, badge }: { href: string; label: string; desc: string; badge: string }) {
  return (
    <Link
      href={href}
      className="group border border-navy/10 bg-white p-6 transition hover:border-navy/30 hover:shadow-sm"
    >
      <p className="text-[10px] uppercase tracking-widest text-navy/40 mb-2">{badge}</p>
      <p className="text-base font-semibold text-navy group-hover:text-navy transition">
        {label} →
      </p>
      <p className="mt-1.5 text-sm text-navy/55 leading-relaxed">{desc}</p>
    </Link>
  );
}
