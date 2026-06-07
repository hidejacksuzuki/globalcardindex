'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale }        from './config';
import type { Translations }  from './index';
import { ja }                 from './translations/ja';

interface I18nContextValue {
  locale: Locale;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'ja',
  t:      ja as Translations,
});

export function I18nProvider({
  locale,
  translations,
  children,
}: {
  locale:        Locale;
  translations:  Translations;
  children:      ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, t: translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

/** Shorthand hook — returns just the translations object. */
export function useT(): Translations {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
