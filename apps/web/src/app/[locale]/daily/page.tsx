import type { Metadata }             from 'next';
import { getDailyRecap, getRecentRecapDates } from '@gci/core';
import { RecapView }                  from '@/components/market/RecapView';
import type { Locale }                from '@/i18n/config';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn  = params.locale === 'en';
  // タイトルは「今日」ではなく実際に表示する最新リキャップの日付に合わせる
  // （今日の分が未生成の間、タイトルと本文がズレるのを防ぐ）。
  // timeZone を明示しないと Vercel(UTC)で日付が1日戻るため Asia/Tokyo を指定。
  const recap = await getDailyRecap().catch(() => null);
  const dateSource = recap?.date ? new Date(recap.date + 'T00:00:00+09:00') : new Date();
  const displayDate = dateSource.toLocaleDateString(isEn ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
  });
  return {
    title: `Daily Market Recap ${displayDate} | Global Card Index`,
    description: isEn
      ? `${displayDate} trading card market summary. Top gainers, losers, and volume spikes with index data.`
      : `${displayDate}のトレカ市場まとめ。高騰・暴落・出品急増カードを指数と合わせて掲載。`,
  };
}

export default async function DailyPage({ params }: { params: { locale: Locale } }) {
  let recap = null;
  let archiveDates: string[] = [];
  try {
    [recap, archiveDates] = await Promise.all([
      getDailyRecap(),
      getRecentRecapDates(30),
    ]);
  } catch {}
  if (!recap) return null;

  return <RecapView recap={recap} isLive={true} archiveDates={archiveDates} />;
}
