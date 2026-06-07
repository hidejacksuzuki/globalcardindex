export const locales = ['ja', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ja';

export const LOCALE_COOKIE = 'gci_locale';

export function isValidLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
