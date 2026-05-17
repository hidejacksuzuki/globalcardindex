import type { Metadata }   from "next";
import { notFound }         from "next/navigation";
import { getDailyRecapByDate, getRecentRecapDates } from "@gci/core";
import { RecapView }        from "@/components/market/RecapView";

// DB に存在する日付だけ静的生成（直近90日）
export async function generateStaticParams() {
  try {
    const dates = await getRecentRecapDates(90);
    return dates.map((date) => ({ date }));
  } catch {
    return [];
  }
}

// ISR: 新しいアーカイブが保存されたら on-demand revalidation か時間で再生成
export const revalidate = 86400; // 24h（アーカイブは基本変わらない）

export async function generateMetadata({
  params,
}: {
  params: { date: string };
}): Promise<Metadata> {
  const snap = await getDailyRecapByDate(params.date);
  if (!snap) return {};

  const displayDate = new Date(params.date + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
  const title       = `Daily Recap ${displayDate} | Global Card Index`;
  const description = snap.editorNote.slice(0, 120);
  const url         = `https://globalcardindex.com/daily/${params.date}`;

  return {
    title,
    description,
    openGraph: { title, description, url, siteName: "Global Card Index", type: "website" },
    twitter:   { card: "summary_large_image", title, description },
    alternates: { canonical: url },
  };
}

export default async function DailyArchivePage({
  params,
}: {
  params: { date: string };
}) {
  // date フォーマットバリデーション ("YYYY-MM-DD")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) notFound();

  const [snap, archiveDates] = await Promise.all([
    getDailyRecapByDate(params.date),
    getRecentRecapDates(30),
  ]);

  if (!snap) notFound();

  return <RecapView recap={snap} isLive={false} archiveDates={archiveDates} />;
}
