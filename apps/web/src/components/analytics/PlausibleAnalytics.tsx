/**
 * PlausibleAnalytics.tsx
 *
 * Loads the Plausible Analytics script in the <head>.
 * Privacy-first, no cookies, no consent banner required.
 *
 * Env var: NEXT_PUBLIC_PLAUSIBLE_DOMAIN (e.g. "globalcardindex.com")
 * Leave unset to disable tracking (dev / staging).
 *
 * Custom event API (call from any Client Component or onClick handler):
 *
 *   import { trackEvent } from "@/components/analytics/PlausibleAnalytics";
 *
 *   trackEvent("Watchlist Add", { card: slug });
 *   trackEvent("Search",        { query: q });
 *   trackEvent("Outbound",      { url });
 */

import Script from "next/script";

const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

// Plausible auto-tracks all pageviews when the script loads.
// Custom events are sent via window.plausible().
export function PlausibleAnalytics() {
  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.tagged-events.js"
      strategy="afterInteractive"
    />
  );
}

// ── Custom event helpers ──────────────────────────────────────────────────────

type PlausibleFn = (
  event: string,
  opts?: { props?: Record<string, string | number | boolean> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

/**
 * Fire a Plausible custom event.
 * Safe to call server-side (no-ops silently).
 */
export function trackEvent(
  event: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  window.plausible?.(event, props ? { props } : undefined);
}

// ── Pre-named event helpers (keeps call sites concise) ────────────────────────

/** Card detail page view — call on /cards/[slug] mount */
export function trackCardView(slug: string): void {
  trackEvent("Card View", { card: slug });
}

/** Search query submitted */
export function trackSearch(query: string, resultCount: number): void {
  trackEvent("Search", { query, results: resultCount });
}

/** Watchlist add/remove */
export function trackWatchlist(action: "add" | "remove", slug: string): void {
  trackEvent("Watchlist", { action, card: slug });
}

/** Outbound link to Mercari or other marketplace */
export function trackOutbound(url: string): void {
  trackEvent("Outbound Link", { url });
}
