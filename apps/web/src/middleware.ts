/**
 * middleware.ts — locale detection + auth guard
 *
 * Locale routing strategy:
 *   /en/...   → English  (explicit prefix)
 *   /...      → Japanese (default, no prefix required)
 *
 * Flow:
 *   1. Read locale from URL prefix, cookie, or Accept-Language
 *   2. Rewrite internally to /[locale]/... so Next.js routes to app/[locale]/
 *   3. Set `gci_locale` cookie for server components
 *   4. Guard /account behind Auth.js session
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { locales, defaultLocale, isValidLocale, type Locale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/i18n/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BYPASS_PREFIXES = ['/api/', '/_next/', '/favicon', '/robots', '/sitemap', '/feed.xml'];

function shouldBypass(pathname: string): boolean {
  return BYPASS_PREFIXES.some((p) => pathname.startsWith(p));
}

function getLocaleFromPath(pathname: string): { locale: Locale; rest: string; isDefault: boolean } | null {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const rest = pathname.slice(locale.length + 1) || '/';
      return { locale: locale as Locale, rest, isDefault: locale === defaultLocale };
    }
  }
  return null;
}

function getLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  const langs = header.split(',').map((s) => s.split(';')[0].trim().toLowerCase().slice(0, 2));
  for (const lang of langs) {
    if (isValidLocale(lang)) return lang as Locale;
  }
  return defaultLocale;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (shouldBypass(pathname)) return NextResponse.next();

  // 1. Determine locale
  const fromPath = getLocaleFromPath(pathname);
  let locale: Locale;
  let rewritePath: string;

  if (fromPath) {
    // /ja/... → redirect to /... (default locale has no prefix)
    if (fromPath.isDefault) {
      const target = new URL(fromPath.rest, req.url);
      target.search = req.nextUrl.search;
      const res = NextResponse.redirect(target, { status: 301 });
      res.cookies.set(LOCALE_COOKIE, defaultLocale, {
        path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax',
      });
      return res;
    }
    locale      = fromPath.locale;
    rewritePath = `/${locale}${fromPath.rest === '/' ? '' : fromPath.rest}`;
  } else {
    // No prefix: check cookie → Accept-Language → default
    const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
    if (cookieLocale && isValidLocale(cookieLocale) && cookieLocale !== defaultLocale) {
      // Redirect to locale-prefixed URL for non-default preference
      const target = new URL(`/${cookieLocale}${pathname}`, req.url);
      target.search = req.nextUrl.search;
      return NextResponse.redirect(target);
    }
    locale      = defaultLocale;
    rewritePath = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
  }

  // 2. Auth guard — check effective (un-prefixed) path
  const effectivePath = fromPath ? fromPath.rest : pathname;
  if (['/account'].some((p) => effectivePath.startsWith(p))) {
    const session = await auth();
    if (!session) {
      const prefix   = locale === defaultLocale ? '' : `/${locale}`;
      const loginUrl = new URL(`${prefix}/login`, req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Rewrite to /[locale]/...
  const response = NextResponse.rewrite(new URL(rewritePath, req.url));

  // 4. Persist locale in cookie
  response.cookies.set(LOCALE_COOKIE, locale, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)).*)',
  ],
};
