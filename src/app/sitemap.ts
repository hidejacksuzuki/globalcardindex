import type { MetadataRoute } from "next";
import { getGameSlugs }       from "@/lib/seo/games";
import { getAllSetNames, getAllCardSlugs } from "@/actions/seo";
import { getRecentRecapDates }            from "@/actions/recap";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://globalcardindex.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [setNames, cardSlugs, recapDates] = await Promise.all([
    getAllSetNames(),
    getAllCardSlugs(),
    getRecentRecapDates(90),
  ]);

  const now = new Date();

  // 静的ページ
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url:          `${BASE_URL}/daily`,
      lastModified: now,
      changeFrequency: "daily",
      priority:     0.9,
    },
    {
      url:          `${BASE_URL}/trending`,
      lastModified: now,
      changeFrequency: "hourly",
      priority:     0.8,
    },
    {
      url:          `${BASE_URL}/gainers`,
      lastModified: now,
      changeFrequency: "hourly",
      priority:     0.8,
    },
    {
      url:          `${BASE_URL}/losers`,
      lastModified: now,
      changeFrequency: "hourly",
      priority:     0.8,
    },
    {
      url:          `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority:     1.0,
    },
    {
      url:          `${BASE_URL}/games`,
      lastModified: now,
      changeFrequency: "weekly",
      priority:     0.9,
    },
    {
      url:          `${BASE_URL}/indices`,
      lastModified: now,
      changeFrequency: "daily",
      priority:     0.8,
    },
    {
      url:          `${BASE_URL}/marketboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority:     0.7,
    },
  ];

  // /games/[slug]
  const gameRoutes: MetadataRoute.Sitemap = getGameSlugs().map((slug) => ({
    url:          `${BASE_URL}/games/${slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority:     0.9,
  }));

  // /sets/[slug]
  const setRoutes: MetadataRoute.Sitemap = setNames.map((name) => ({
    url:          `${BASE_URL}/sets/${encodeURIComponent(name)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority:     0.7,
  }));

  // /cards/[slug]
  const cardRoutes: MetadataRoute.Sitemap = cardSlugs.map((slug) => ({
    url:          `${BASE_URL}/cards/${slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority:     0.6,
  }));

  // /daily/[date] アーカイブ
  const recapRoutes: MetadataRoute.Sitemap = recapDates.map((date) => ({
    url:          `${BASE_URL}/daily/${date}`,
    lastModified: new Date(date),
    changeFrequency: "yearly" as const,  // アーカイブは変わらない
    priority:     0.6,
  }));

  return [
    ...staticRoutes,
    ...gameRoutes,
    ...setRoutes,
    ...cardRoutes,
    ...recapRoutes,
  ];
}
