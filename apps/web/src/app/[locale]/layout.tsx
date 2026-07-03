import type { Metadata } from 'next';
import { notFound }        from 'next/navigation';
import { Header }          from '@/components/layout/Header';
import { Disclaimer }      from '@/components/common/Disclaimer';
import { BetaFeedbackWidget } from '@/components/feedback/BetaFeedbackWidget';
import { PlausibleAnalytics } from '@/components/analytics/PlausibleAnalytics';
import { I18nProvider }    from '@/i18n/context';
import { CurrencyProvider } from '@/lib/currency';
import { getTranslations, locales, isValidLocale } from '@/i18n';
import type { Locale }     from '@/i18n/config';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  const isJa   = locale === 'ja';
  return {
    description: isJa
      ? 'トレーディングカード市場の価格透明性インフラ。指数・マーケットボード・カード別相場を提供。'
      : 'Trading card market price infrastructure. Indices, marketboard, and per-card pricing.',
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isValidLocale(params.locale)) notFound();

  const locale = params.locale as Locale;
  const t      = getTranslations(locale);
  const htmlLang = locale === 'ja' ? 'ja' : 'en';

  return (
    <I18nProvider locale={locale} translations={t}>
      <CurrencyProvider>
        {/* Override html lang per locale */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.lang="${htmlLang}"`,
          }}
        />
        <PlausibleAnalytics />
        <Header />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-navy/10 bg-white mt-16">
          <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

            {/* Community row: Discord + Newsletter */}
            {process.env.NEXT_PUBLIC_DISCORD_INVITE && (
              <div className="flex flex-wrap items-center gap-4 rounded border border-navy/10 bg-navy/[0.02] px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-navy/70 uppercase tracking-widest">
                    {t.footer.community}
                  </p>
                  <p className="text-sm text-navy/60 mt-0.5">{t.footer.communityDesc}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={process.env.NEXT_PUBLIC_DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-indigo-400 px-4 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                  >
                    {t.footer.discord}
                  </a>
                  <a
                    href="/newsletter"
                    className="rounded border border-navy/20 px-4 py-1.5 text-xs font-medium text-navy/60 transition hover:border-navy/40 hover:text-navy"
                  >
                    {t.footer.newsletterSubscribe}
                  </a>
                </div>
              </div>
            )}

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-navy/50">
              <a href="/"              className="hover:text-navy transition">{t.footer.home}</a>
              <a href="/marketboard"   className="hover:text-navy transition">{t.nav.marketboard}</a>
              <a href="/cards"         className="hover:text-navy transition">{t.nav.cards}</a>
              <a href="/most-requested" className="hover:text-navy transition">{t.footer.mostRequested}</a>
              <a href="/games"         className="hover:text-navy transition">{t.nav.games}</a>
              <a href="/daily"         className="hover:text-navy transition">{t.nav.daily}</a>
              <a href="/indices"       className="hover:text-navy transition">{t.nav.indices}</a>
              <a href="/newsletter"    className="hover:text-navy transition">{t.nav.newsletter}</a>
              <a href="/about"         className="hover:text-navy transition">{t.nav.about}</a>
              <a href="/beta"          className="hover:text-navy transition">{t.footer.beta}</a>
              <a href="/terms"         className="hover:text-navy transition font-medium">{t.footer.terms}</a>
            </nav>

            <Disclaimer variant="footer" />
          </div>
        </footer>

        <BetaFeedbackWidget />
      </CurrencyProvider>
    </I18nProvider>
  );
}
