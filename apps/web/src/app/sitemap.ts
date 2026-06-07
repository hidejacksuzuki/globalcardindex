import type { MetadataRoute } from 'next';
import { getGameSlugs, getAllSetNames, getAllCardSlugs, getRecentRecapDates } from '@gci/core';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://gci-index.com';
const LOCALES  = ['ja', 'en'] as const;

/** Build a URL with locale prefix (ja has no prefix, en gets /en/). */
function url(path: string, locale: string): string {
  const prefix = locale === 'ja' ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${path === '/' ? '' : path}` || `${BASE_URL}/`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [setNames, cardSlugs, recapDates] = await Promise.all([
    getAllSetNames().catch(() => [] as string[]),
    getAllCardSlugs().catch(() => [] as string[]),
    getRecentRecapDates(90).catch(() => [] as string[]),
  ]);

  const now = new Date();

  const staticPaths: Array<{ path: string; freq: MetadataRoute.Sitemap[0]['changeFrequency']; pri: number }> = [
    { path: '/',              freq: 'daily',   pri: 1.0 },
    { path: '/daily',         freq: 'daily',   pri: 0.9 },
    { path: '/trending',      freq: 'hourly',  pri: 0.8 },
    { path: '/gainers',       freq: 'hourly',  pri: 0.8 },
    { path: '/losers',        freq: 'hourly',  pri: 0.8 },
    { path: '/games',         freq: 'weekly',  pri: 0.9 },
    { path: '/indices',       freq: 'daily',   pri: 0.8 },
    { path: '/marketboard',   freq: 'daily',   pri: 0.7 },
    { path: '/cards',         freq: 'daily',   pri: 0.8 },
    { path: '/about',         freq: 'monthly', pri: 0.7 },
    { path: '/newsletter',    freq: 'monthly', pri: 0.5 },
    { path: '/most-requested', freq: 'daily',  pri: 0.7 },
    { path: '/beta',          freq: 'monthly', pri: 0.4 },
    { path: '/terms',         freq: 'monthly', pri: 0.3 },
  ];

  const gameSlugs = getGameSlugs();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    // Static pages
    for (const { path, freq, pri } of staticPaths) {
      entries.push({ url: url(path, locale), lastModified: now, changeFrequency: freq, priority: pri });
    }

    // Games
    for (const slug of gameSlugs) {
      entries.push({ url: url(`/games/${slug}`, locale), lastModified: now, changeFrequency: 'daily', priority: 0.9 });
    }

    // Sets
    for (const name of setNames) {
      entries.push({ url: url(`/sets/${encodeURIComponent(name)}`, locale), lastModified: now, changeFrequency: 'daily', priority: 0.7 });
    }

    // Cards (JA priority higher — primary data source is Japanese market)
    for (const slug of cardSlugs) {
      entries.push({ url: url(`/cards/${slug}`, locale), lastModified: now, changeFrequency: 'daily', priority: locale === 'ja' ? 0.7 : 0.5 });
    }

    // Daily archive
    for (const date of recapDates) {
      entries.push({ url: url(`/daily/${date}`, locale), lastModified: new Date(date), changeFrequency: 'yearly', priority: 0.5 });
    }
  }

  return entries;
}
