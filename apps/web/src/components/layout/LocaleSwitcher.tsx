'use client';

import { useLocale, useT } from '@/i18n/context';
import { locales, type Locale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/i18n/server';
import { useRouter, usePathname } from 'next/navigation';

export function LocaleSwitcher() {
  const locale    = useLocale();
  const t         = useT();
  const router    = useRouter();
  const pathname  = usePathname();

  function handleChange(next: Locale) {
    if (next === locale) return;

    // Write cookie
    document.cookie = [
      `${LOCALE_COOKIE}=${next}`,
      'path=/',
      `max-age=${60 * 60 * 24 * 365}`,
      'SameSite=Lax',
    ].join(';');

    // Build target URL:
    //   current path might be /ja/about or /about (ja default, no prefix)
    //   strip existing locale prefix, then add new one if non-default
    const stripped = stripLocalePrefix(pathname, locales as unknown as string[]);

    const defaultLocale: Locale = 'ja';
    const target = next === defaultLocale ? stripped || '/' : `/${next}${stripped}`;

    router.push(target);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {(locales as readonly Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => handleChange(l)}
          className={[
            'px-2 py-0.5 text-[11px] rounded transition',
            l === locale
              ? 'bg-navy text-white'
              : 'text-navy/50 hover:text-navy hover:bg-navy/10',
          ].join(' ')}
          aria-label={t.locale[l]}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function stripLocalePrefix(pathname: string, locales: string[]): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}
