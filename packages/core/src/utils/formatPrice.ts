/**
 * Format a price value as a localized currency string.
 *
 * @param value    - numeric price
 * @param currency - ISO 4217 currency code (e.g. "JPY", "USD")
 * @param locale   - BCP 47 locale string (e.g. "ja", "en", "en-US").
 *                   Defaults to "ja-JP" for backward compatibility.
 */
export function formatPrice(
  value: number,
  currency = "JPY",
  locale = "ja-JP",
): string {
  try {
    // Normalize shorthand locales to full BCP 47 tags expected by Intl
    const intlLocale = normalizeLocale(locale);
    return new Intl.NumberFormat(intlLocale, {
      style:                "currency",
      currency,
      maximumFractionDigits: noDecimalCurrencies.has(currency.toUpperCase()) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Currencies that display without decimal places. */
const noDecimalCurrencies = new Set(["JPY", "KRW", "IDR", "VND", "TWD"]);

/** Map short locale codes to full BCP 47 tags. */
function normalizeLocale(locale: string): string {
  const map: Record<string, string> = {
    ja: "ja-JP",
    en: "en-US",
    ko: "ko-KR",
    zh: "zh-CN",
  };
  return map[locale] ?? locale;
}
