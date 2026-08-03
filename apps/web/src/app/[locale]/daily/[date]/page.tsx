import type { Metadata }   from 'next';
import { notFound }         from 'next/navigation';
import { unstable_cache }   from 'next/cache';
import { getDailyRecapByDate, getRecentRecapDates } from '@gci/core';
import { RecapView }        from '@/components/market/RecapView';
import type { Locale }      from '@/i18n/config';

// 障害修正 (2026-07-31): 以前は revalidate=86400 の ISR にしていたが、
// [locale] レイアウトが cookies()（ロケール・認証）を読むため、本番の
// オンデマンド静的生成が DYNAMIC_SERVER_USAGE で必ず 500 になっていた
// （dev は常に動的レンダリングのため再現しない）。
// ページは動的レンダリングとし、データ取得側を unstable_cache でキャッシュする。
export const dynamic = 'force-dynamic';

const cachedRecapByDate = unstable_cache(
  (date: string) => getDailyRecapByDate(date),
  ['daily-recap-by-date'],
  { revalidate: 3600 },
);
const cachedRecapDates = unstable_cache(
  () => getRecentRecapDates(30),
  ['daily-recap-dates'],
  { revalidate: 3600 },
);

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; date: string };
}): Promise<Metadata> {
  const isEn = params.locale === 'en';
  const snap  = await cachedRecapByDate(params.date);
  if (!snap) return {};

  const displayDate = new Date(params.date + 'T00:00:00+09:00').toLocaleDateString(
    isEn ? 'en-US' : 'ja-JP',
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
  );
  const title       = `Daily Recap ${displayDate} | Global Card Index`;
  const description = snap.editorNote.slice(0, 120);
  const url         = `https://www.gci-index.com/daily/${params.date}`;

  return {
    title,
    description,
    openGraph: { title, description, url, siteName: 'Global Card Index', type: 'website' },
    twitter:   { card: 'summary_large_image', title, description },
    alternates: { canonical: url },
  };
}

export default async function DailyArchivePage({
  params,
}: {
  params: { locale: Locale; date: string };
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();

  const [snap, archiveDates] = await Promise.all([
    cachedRecapByDate(params.date),
    cachedRecapDates(),
  ]);

  if (!snap) notFound();

  return <RecapView recap={snap} isLive={false} archiveDates={archiveDates} />;
}
