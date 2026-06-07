import type { Metadata }            from "next";
import { getDailyRecap, getRecentRecapDates } from "@gci/core";
import { RecapView }                 from "@/components/market/RecapView";

export const revalidate = 3600; // 1時間 ISR

export async function generateMetadata(): Promise<Metadata> {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
  return {
    title:       `Daily Market Recap ${today} | Global Card Index`,
    description: `${today}のトレカ市場まとめ。高騰・暴落・出品急増カードを指数と合わせて掲載。`,
  };
}

export default async function DailyPage() {
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
