'use client';

/**
 * PriceCell — currency-aware price display for server-rendered tables.
 *
 * Usage:
 *   <PriceCell price={card.latestPrice} storedCurrency={card.currency} />
 *
 * Reads the active display currency from CurrencyContext, so prices update
 * instantly when the user switches currency in the header.
 */

import { useCurrency, formatCurrency, type Currency } from '@/lib/currency';
import { useLocale } from '@/i18n/context';

interface Props {
  price:           number | null | undefined;
  storedCurrency:  string | null | undefined;
  className?:      string;
}

export function PriceCell({ price, storedCurrency, className }: Props) {
  const { currency } = useCurrency();
  const locale       = useLocale();

  if (price == null || !storedCurrency) {
    return <span className="text-navy/25">—</span>;
  }

  const formatted = formatCurrency(
    price,
    storedCurrency as Currency,
    currency,
    locale,
  );

  return <span className={className}>{formatted}</span>;
}

/**
 * PriceChangeCell — absolute price change (used in 7d/30d change columns).
 * Shows formatted amount in the active display currency, with sign.
 */
interface ChangeCellProps {
  abs:             number | null | undefined;
  storedCurrency:  string | null | undefined;
  positive?:       boolean; // if true → prefix "+"
}

export function PriceChangeCell({ abs, storedCurrency, positive }: ChangeCellProps) {
  const { currency } = useCurrency();
  const locale       = useLocale();

  if (abs == null || !storedCurrency) return null;

  const formatted = formatCurrency(
    Math.abs(abs),
    storedCurrency as Currency,
    currency,
    locale,
  );

  return (
    <span className="tabular-nums text-[10px] opacity-55">
      {positive ? '+' : '-'}{formatted}
    </span>
  );
}
