'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ── Supported currencies ──────────────────────────────────────────────────────

export const CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP', 'KRW', 'CNY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_COOKIE   = 'gci_currency';
export const DEFAULT_CURRENCY: Currency = 'JPY';

/**
 * Approximate FX rates relative to JPY (1 JPY = X foreign currency).
 * Override at build time via NEXT_PUBLIC_FX_<CURRENCY> env vars.
 *
 *   NEXT_PUBLIC_FX_USD=0.0065
 *   NEXT_PUBLIC_FX_EUR=0.0060
 *   NEXT_PUBLIC_FX_GBP=0.0051
 *   NEXT_PUBLIC_FX_KRW=8.9
 *   NEXT_PUBLIC_FX_CNY=0.049
 */
export function getFxRates(): Record<Currency, number> {
  return {
    JPY: 1,
    USD: parseEnvRate('NEXT_PUBLIC_FX_USD', 1 / 155),
    EUR: parseEnvRate('NEXT_PUBLIC_FX_EUR', 1 / 168),
    GBP: parseEnvRate('NEXT_PUBLIC_FX_GBP', 1 / 195),
    KRW: parseEnvRate('NEXT_PUBLIC_FX_KRW', 8.85),
    CNY: parseEnvRate('NEXT_PUBLIC_FX_CNY', 0.049),
  };
}

function parseEnvRate(key: string, fallback: number): number {
  const v = (process.env as Record<string, string | undefined>)[key];
  if (v) {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

/** Convert a JPY amount to the target currency using cached rates. */
export function convertCurrency(
  amountJpy: number,
  to: Currency,
  rates = getFxRates(),
): number {
  return amountJpy * (rates[to] ?? 1);
}

/**
 * Format a price for display. Converts from storedCurrency to displayCurrency,
 * then formats using Intl.NumberFormat.
 *
 * @param value           – stored price value
 * @param storedCurrency  – currency the value is stored in (usually JPY)
 * @param displayCurrency – currency the user wants to see
 * @param locale          – BCP 47 locale string (e.g. "ja", "en-US")
 */
export function formatCurrency(
  value: number,
  storedCurrency: Currency,
  displayCurrency: Currency,
  locale: string,
): string {
  const rates = getFxRates();

  // Convert to JPY base first, then to target
  const jpyValue =
    storedCurrency === 'JPY' ? value : value / (rates[storedCurrency] ?? 1);
  const converted =
    displayCurrency === 'JPY' ? jpyValue : jpyValue * (rates[displayCurrency] ?? 1);

  try {
    return new Intl.NumberFormat(locale, {
      style:                'currency',
      currency:             displayCurrency,
      maximumFractionDigits: displayCurrency === 'JPY' || displayCurrency === 'KRW' ? 0 : 2,
    }).format(converted);
  } catch {
    return `${converted.toFixed(0)} ${displayCurrency}`;
  }
}

// ── Cookie helpers (client-side) ──────────────────────────────────────────────

export function readCurrencyCookie(): Currency {
  if (typeof document === 'undefined') return DEFAULT_CURRENCY;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CURRENCY_COOKIE}=([^;]+)`),
  );
  const val = match?.[1];
  return val && (CURRENCIES as readonly string[]).includes(val)
    ? (val as Currency)
    : DEFAULT_CURRENCY;
}

export function writeCurrencyCookie(currency: Currency): void {
  if (typeof document === 'undefined') return;
  document.cookie = [
    `${CURRENCY_COOKIE}=${currency}`,
    'path=/',
    `max-age=${60 * 60 * 24 * 365}`,
    'SameSite=Lax',
  ].join(';');
}

// ── React context ─────────────────────────────────────────────────────────────

interface CurrencyContextValue {
  currency:    Currency;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency:    DEFAULT_CURRENCY,
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);

  useEffect(() => {
    setCurrencyState(readCurrencyCookie());
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    writeCurrencyCookie(c);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
