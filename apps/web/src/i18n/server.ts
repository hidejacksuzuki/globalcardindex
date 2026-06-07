import { cookies } from 'next/headers';
import { defaultLocale, isValidLocale, type Locale } from './config';
import { getTranslations } from './index';

export const LOCALE_COOKIE = 'gci_locale';

/** Read locale from cookie (set by middleware). Falls back to defaultLocale. */
export function getLocale(): Locale {
  const cookieStore = cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  if (value && isValidLocale(value)) return value;
  return defaultLocale;
}

/** Convenience: get translations for the current request's locale. */
export function getServerTranslations() {
  return getTranslations(getLocale());
}
