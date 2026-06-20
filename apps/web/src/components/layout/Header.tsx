import Link  from 'next/link';
import Image from 'next/image';
import { getServerTranslations } from '@/i18n/server';
import { LocaleSwitcher }   from './LocaleSwitcher';
import { CurrencySwitcher } from './CurrencySwitcher';

export async function Header() {
  const t = getServerTranslations();

  return (
    <header className="border-b border-navy/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image
            src="/logo.png"
            alt="Global Card Index"
            width={360}
            height={96}
            className="h-20 w-auto"
            priority
          />
        </Link>

        {/* Main nav */}
        <nav className="flex items-center gap-5 text-sm text-navy/70 flex-1 justify-end flex-wrap">
          <Link href="/games"       className="transition hover:text-navy hidden md:inline">{t.nav.games}</Link>
          <Link href="/daily"       className="transition hover:text-navy font-medium">{t.nav.daily}</Link>
          <Link href="/trending"    className="transition hover:text-navy hidden lg:inline">{t.nav.trending}</Link>
          <Link href="/indices"     className="transition hover:text-navy hidden lg:inline">{t.nav.indices}</Link>
          <Link href="/marketboard" className="transition hover:text-navy hidden md:inline">{t.nav.marketboard}</Link>
          <Link href="/cards"       className="transition hover:text-navy">{t.nav.cards}</Link>
          <Link href="/watchlist"   className="transition hover:text-navy hidden sm:inline">{t.nav.watchlist}</Link>
          <Link href="/portfolio"   className="transition hover:text-navy hidden sm:inline">{t.nav.portfolio}</Link>
          <Link href="/about"       className="transition hover:text-navy text-navy/50 hidden lg:inline">{t.nav.about}</Link>
          <Link
            href="/newsletter"
            className="rounded border border-gold/60 bg-gold/5 px-3 py-1 text-xs font-medium text-navy/70 transition hover:bg-gold/10 shrink-0"
          >
            {t.nav.newsletter}
          </Link>
        </nav>

        {/* Locale + currency switchers */}
        <div className="flex items-center gap-2 shrink-0">
          <LocaleSwitcher />
          <CurrencySwitcher />
        </div>
      </div>
    </header>
  );
}
