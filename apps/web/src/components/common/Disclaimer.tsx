/**
 * Shared disclaimer banner — locale-aware via server translations.
 *
 * Variants:
 *   "inline"  — compact single-line note for card detail pages
 *   "banner"  — full-width expandable banner for list pages
 *   "footer"  — small footer note
 */

import { getServerTranslations } from '@/i18n/server';

type DisclaimerVariant = 'inline' | 'banner' | 'footer';

export function Disclaimer({ variant = 'banner' }: { variant?: DisclaimerVariant }) {
  const t = getServerTranslations();
  const d = t.disclaimer;

  if (variant === 'inline') {
    return (
      <p className="text-[11px] text-navy/40 border-t border-navy/5 pt-3 mt-3">
        {d.inline}
        <a href="/terms" className="underline underline-offset-2 hover:text-navy/60 ml-1">
          {d.termsLinkShort}
        </a>
      </p>
    );
  }

  if (variant === 'footer') {
    return (
      <p className="text-[11px] text-navy/30 text-center">
        {d.footer}{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-navy/50">
          {d.termsLinkShort}
        </a>
      </p>
    );
  }

  // banner (default)
  return (
    <aside className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <p>
        <span className="font-semibold">{d.note}</span>{' '}
        {d.banner}{' '}
        <a href="/terms" className="underline underline-offset-2 font-medium hover:text-amber-900">
          {d.termsLink}
        </a>
      </p>
    </aside>
  );
}

/**
 * Confidence explanation callout — explains what HIGH/MED/LOW means.
 */
export function ConfidenceExplainer() {
  const t = getServerTranslations();
  const c = t.confidence;

  return (
    <aside className="rounded border border-navy/10 bg-navy/[0.02] px-5 py-4 text-xs text-navy/60 space-y-2">
      <p className="font-semibold text-navy/80 text-sm">{c.title}</p>
      <p>{c.description}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <ConfidenceTip tier="HIGH" label={c.highLabel} desc={c.highDesc} />
        <ConfidenceTip tier="MED"  label={c.medLabel}  desc={c.medDesc}  />
        <ConfidenceTip tier="LOW"  label={c.lowLabel}  desc={c.lowDesc}  />
      </div>
    </aside>
  );
}

function ConfidenceTip({ tier, label, desc }: { tier: 'HIGH' | 'MED' | 'LOW'; label: string; desc: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-green-100 text-green-700',
    MED:  'bg-amber-100 text-amber-700',
    LOW:  'bg-red-100 text-red-600',
  };
  return (
    <div className="flex items-start gap-2 min-w-[200px] max-w-xs">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[tier]}`}>
        {label}
      </span>
      <span>{desc}</span>
    </div>
  );
}
