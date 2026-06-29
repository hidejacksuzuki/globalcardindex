import Link  from 'next/link';
import Image from 'next/image';
import { getServerTranslations } from '@/i18n/server';
import { LocaleSwitcher }   from './LocaleSwitcher';
import { CurrencySwitcher } from './CurrencySwitcher';
import { MobileMenu }       from './MobileMenu';

export async function Header() {
  const t = getServerTranslations();

  const navLinks = [
    { href: '/games',       label: t.nav.games,       desktop: 'hidden md:inline' },
    { href: '/daily',       label: t.nav.daily,       desktop: 'font-medium' },
    { href: '/trending',    label: t.nav.trending,    desktop: 'hidden lg:inline' },
    { href: '/indices',     label: t.nav.indices,     desktop: 'hidden lg:inline' },
    { href: '/marketboard', label: t.nav.marketboard, desktop: 'hidden md:inline' },
    { href: '/cards',       label: t.nav.cards,       desktop: '' },
    { href: '/watchlist',   label: t.nav.watchlist,   desktop: 'hidden sm:inline' },
    { href: '/portfolio',   label: t.nav.portfolio,   desktop: 'hidden sm:inline' },
    { href: '/about',       label: t.nav.about,       desktop: 'hidden lg:inline text-navy/50' },
  ];

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

        {/* Desktop nav */}
        <nav className="flex items-center gap-5 text-sm text-navy/70 flex-1 justify-end flex-wrap">
          {navLinks.map(({ href, label, desktop }) => (
            <Link
              key={href}
              href={href}
              className={`transition hover:text-navy ${desktop}`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/newsletter"
            className="rounded border border-gold/60 bg-gold/5 px-3 py-1 text-xs font-medium text-navy/70 transition hover:bg-gold/10 shrink-0"
          >
            {t.nav.newsletter}
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <LocaleSwitcher />
          <CurrencySwitcher />
          {/* Mobile hamburger */}
          <MobileMenu links={navLinks} newsletterLabel={t.nav.newsletter} />
        </div>
      </div>
    </header>
  );
}
