import type { Metadata }             from 'next';
import { getDailyRecap, getRecentRecapDates } from '@gci/core';
import { RecapView }                  from '@/components/market/RecapView';
import type { Locale }                from '@/i18n/config';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn  = params.locale === 'en';
  const today  = new Date().toLocaleDateString(isEn ? 'en-US' : 'ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return {
    title: `Daily Market Recap ${today} | Global Card Index`,
    description: isEn
      ? `${today} trading card market summary. Top gainers, losers, and volume spikes with index data.`
      : `${today}のトレカ市場まとめ。高騰・暴落・出品急増カードを指数と合わせて掲載。`,
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
