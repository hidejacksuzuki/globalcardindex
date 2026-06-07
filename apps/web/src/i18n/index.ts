import type { Locale } from './config';
import { ja } from './translations/ja';
import { en } from './translations/en';

export type { Locale };
export { locales, defaultLocale, isValidLocale } from './config';

/**
 * `Translations` is structurally derived from `ja` but uses `string` for all
 * leaf values so both ja (literal types) and en (different literals) satisfy it.
 *
 * We achieve this by mapping all leaves to `string` via a recursive type.
 */
type DeepString<T> = T extends object
  ? { readonly [K in keyof T]: DeepString<T[K]> }
  : string;

export type Translations = DeepString<typeof ja>;

// Both ja and en satisfy Translations because all leaves are strings.
const translationMap: Record<Locale, Translations> = {
  ja: ja as Translations,
  en: en as Translations,
};

export function getTranslations(locale: Locale): Translations {
  return translationMap[locale] ?? (ja as Translations);
}
