import type { Metadata }   from 'next';
import { notFound }         from 'next/navigation';
import { getDailyRecapByDate, getRecentRecapDates } from '@gci/core';
import { RecapView }        from '@/components/market/RecapView';
import type { Locale }      from '@/i18n/config';

// ビルド時プリレンダーはしない（2026-07-08）。以前は直近90日分を静的生成して
// いたが、多数ページの同時プリレンダーが getGameStats 等の重いクエリと競合し、
// Supabase の接続プールを枯渇させてビルドが不安定だった。dynamicParams（既定
// true）により各日付は初回アクセスでオンデマンド生成し revalidate でキャッシュする。
export async function generateStaticParams() {
  return [];
}

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; date: string };
}): Promise<Metadata> {
  const isEn = params.locale === 'en';
  const snap  = await getDailyRecapByDate(params.date);
  if (!snap) return {};

  const displayDate = new Date(params.date + 'T00:00:00+09:00').toLocaleDateString(
    isEn ? 'en-US' : 'ja-JP',
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
  );
  const title       = `Daily Recap ${displayDate} | Global Card Index`;
  const description = snap.editorNote.slice(0, 120);
  const url         = `https://gci-index.com/daily/${params.date}`;

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
    getDailyRecapByDate(params.date),
    getRecentRecapDates(30),
  ]);

  if (!snap) notFound();

  return <RecapView recap={snap} isLive={false} archiveDates={archiveDates} />;
}
