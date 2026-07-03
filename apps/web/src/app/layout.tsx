/**
 * Root HTML shell — minimal. Locale-specific layout lives in [locale]/layout.tsx.
 */
import type { Metadata } from 'next';
import { Inter }         from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://gci-index.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  'Global Card Index',
    template: '%s | GCI',
  },
  description:
    'Trading card market price infrastructure. Indices, marketboard, and per-card pricing.',
  openGraph: {
    siteName: 'Global Card Index',
    type:     'website',
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    types: { 'application/rss+xml': `${BASE_URL}/feed.xml` },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang is set per-locale in [locale]/layout.tsx via suppressHydrationWarning
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.className} text-navy`}>{children}</body>
    </html>
  );
}
