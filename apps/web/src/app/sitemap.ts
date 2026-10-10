import type { MetadataRoute } from 'next';
import { getGameSlugs, getSitemapCards, getRecentRecapDates } from '@gci/core';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.gci-index.com';
const LOCALES  = ['ja', 'en'] as const;

/** Build a URL with locale prefix (ja has no prefix, en gets /en/). */
function url(path: string, locale: string): string {
  const prefix = locale === 'ja' ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${path === '/' ? '' : path}` || `${BASE_URL}/`;
}

// ビルド時に1回だけ作ると lastmod がデプロイ日で止まるため、6時間ごとに作り直す
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cards, recapDates] = await Promise.all([
    getSitemapCards().catch(() => []),
    getRecentRecapDates(90).catch(() => [] as string[]),
  ]);

  const now = new Date();

  // セットの lastmod = 収録カードのうち最も新しい lastmod
  const setLastModified = new Map<string, Date>();
  for (const c of cards) {
    const prev = setLastModified.get(c.setName);
    if (!prev || c.lastModified > prev) setLastModified.set(c.setName, c.lastModified);
  }
  const setNames = [...setLastModified.keys()].sort();

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
      entries.push({ url: url(`/sets/${encodeURIComponent(name)}`, locale), lastModified: setLastModified.get(name), changeFrequency: 'daily', priority: 0.7 });
    }

    // Cards (JA priority higher — primary data source is Japanese market)
    for (const { slug, lastModified } of cards) {
      entries.push({ url: url(`/cards/${slug}`, locale), lastModified, changeFrequency: 'daily', priority: locale === 'ja' ? 0.7 : 0.5 });
    }

    // Daily archive
    for (const date of recapDates) {
      entries.push({ url: url(`/daily/${date}`, locale), lastModified: new Date(date), changeFrequency: 'yearly', priority: 0.5 });
    }
  }

  return entries;
}
