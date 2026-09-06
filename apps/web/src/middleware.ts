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
import { locales, defaultLocale, isValidLocale, type Locale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/i18n/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BYPASS_PREFIXES = ['/api/', '/_next/', '/favicon', '/robots', '/sitemap', '/feed.xml', '/admin/'];

/**
 * Next.js の metadata route（opengraph-image / twitter-image）は非 locale ツリー
 * （app/games/[slug]/opengraph-image.tsx 等）で配信される。locale リライトすると
 * app/[locale]/ 側に該当ルートがなく 404 になる（本番で実際に発生していた）ため
 * バイパスする。
 */
function isMetadataRoute(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? '';
  return last.startsWith('opengraph-image') || last.startsWith('twitter-image');
}

function shouldBypass(pathname: string): boolean {
  return BYPASS_PREFIXES.some((p) => pathname.startsWith(p)) || isMetadataRoute(pathname);
}

/**
 * セッションクッキーの存在チェック（middleware 用の軽量ガード）。
 *
 * ここで auth() を呼んではいけない: database セッション戦略では auth() が
 * Prisma で Session テーブルを引くが、Edge middleware から Prisma は使えず
 * 常に null になる。その結果 /login（Node で auth() 成功）との間で
 * 無限リダイレクトループが発生する（2026-07-03 本番で実際に発生）。
 * クッキーの真正性検証は各ページ側の auth()（Node ランタイム）が行う。
 */
function hasSessionCookie(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get('__Secure-authjs.session-token')?.value ??
    req.cookies.get('authjs.session-token')?.value,
  );
}

function getLocaleFromPath(pathname: string): { locale: Locale; rest: string } | null {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      const rest = pathname.slice(locale.length + 1) || '/';
      return { locale: locale as Locale, rest };
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
    // URL が /ja/... または /en/... → そのままリライト
    // (Vercel Edge はリライト後に middleware を再実行するため redirect は使わない)
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
  //    クッキー存在のみの軽量チェック。真の検証は各ページの auth() が行う。
  const effectivePath = fromPath ? fromPath.rest : pathname;
  if (['/account'].some((p) => effectivePath.startsWith(p))) {
    if (!hasSessionCookie(req)) {
      const prefix   = locale === defaultLocale ? '' : `/${locale}`;
      const loginUrl = new URL(`${prefix}/login`, req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Rewrite to /[locale]/...
  //    new URL(path, base) はクエリ文字列を引き継がないため明示的に付け直す
  //    （?sort= ?q= ?page= 等がすべて落ちるバグの修正）
  const rewriteUrl = new URL(rewritePath, req.url);
  rewriteUrl.search = req.nextUrl.search;
  // レイアウトがパスに応じてクローム（GCIヘッダー等）を切り替えられるよう、
  // リライト後のパスをリクエストヘッダーで渡す（layout では usePathname が使えない）
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-gci-path', rewritePath);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: reqHeaders } });

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
