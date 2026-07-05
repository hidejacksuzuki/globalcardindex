import Link  from 'next/link';
import Image from 'next/image';
import { getServerTranslations } from '@/i18n/server';
import { LocaleSwitcher }   from './LocaleSwitcher';
import { CurrencySwitcher } from './CurrencySwitcher';
import { MobileMenu }       from './MobileMenu';
import { auth }             from '@/auth';

export async function Header() {
  const t       = getServerTranslations();
  const session = await auth().catch(() => null);
  const userId  = session?.user?.id ?? null;

  const navLinks = [
    // モバイルではヘッダー幅が375pxに収まらないため隠す（ドロワーメニュー内にあり機能は維持）
    { href: '/cards',       label: 'カード検索',   desktop: 'hidden sm:inline' },
    { href: '/marketboard', label: 'マーケット',   desktop: 'hidden md:inline' },
    { href: '/trending',    label: 'ランキング',   desktop: 'hidden md:inline' },
    { href: '/portfolio',   label: 'Portfolio',    desktop: 'hidden sm:inline' },
    { href: '/indices',     label: 'インサイト',   desktop: 'hidden lg:inline' },
    { href: '/daily',       label: 'ニュース',     desktop: 'hidden lg:inline' },
  ];

  return (
    <header className="border-b border-navy/10 bg-white sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3 gap-2 sm:gap-4">
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
        <nav className="flex items-center gap-5 text-sm text-navy/70 flex-1 justify-center flex-wrap">
          {navLinks.map(({ href, label, desktop }) => (
            <Link key={href} href={href} className={`transition hover:text-navy whitespace-nowrap ${desktop}`}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth + switchers */}
        <div className="flex items-center gap-2 shrink-0">
          <LocaleSwitcher />
          <CurrencySwitcher />

          {userId ? (
            <Link
              href="/account"
              className="hidden sm:inline-flex items-center gap-1.5 border border-navy bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/80 transition"
            >
              マイページ
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/login"
                className="border border-navy/20 px-3 py-1.5 text-xs text-navy/60 hover:border-navy hover:text-navy transition"
              >
                ログイン
              </Link>
              <Link
                href="/login"
                className="border border-navy bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/80 transition"
              >
                新規登録
              </Link>
            </div>
          )}

          {/* Mobile */}
          <MobileMenu links={navLinks} userId={userId} />
        </div>
      </div>
    </header>
  );
}
