import type { Metadata }   from "next";
import { notFound }         from "next/navigation";
import { getDailyRecapByDate, getRecentRecapDates } from "@gci/core";
import { RecapView }        from "@/components/market/RecapView";

// DB に存在する日付だけ静的生成（直近90日）
// ビルド時プリレンダーはしない（2026-07-08）。以前は直近90日分を静的生成して
// いたが、多数ページの同時プリレンダーが getGameStats 等の重いクエリと競合し、
// Supabase の接続プールを枯渇させてビルドが不安定だった。dynamicParams（既定
// true）により各日付は初回アクセスでオンデマンド生成し revalidate でキャッシュする。
export async function generateStaticParams() {
  return [];
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
  const url         = `https://www.gci-index.com/daily/${params.date}`;

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
