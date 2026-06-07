'use client';

import { useCurrency, CURRENCIES, type Currency } from '@/lib/currency';
import { useT } from '@/i18n/context';
import { useState, useRef, useEffect } from 'react';

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const t    = useT();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-navy/20 text-navy/60 hover:border-navy/40 hover:text-navy transition"
        aria-label={t.currency.label}
      >
        <span>{currency}</span>
        <span className="text-[8px] opacity-50">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded border border-navy/15 bg-white shadow-md py-1">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => { setCurrency(c); setOpen(false); }}
              className={[
                'w-full text-left px-3 py-1.5 text-xs transition hover:bg-navy/5',
                c === currency ? 'font-semibold text-navy' : 'text-navy/60',
              ].join(' ')}
            >
              {t.currency[c as Currency]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
