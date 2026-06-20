import type { Metadata }    from "next";
import { redirect }          from "next/navigation";
import Link                  from "next/link";
import { auth }              from "@/auth";
import { getPortfolio }      from "@gci/core";
import { PortfolioClient }   from "./PortfolioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:       "Portfolio | Global Card Index",
  description: "あなたのカードポートフォリオ。総評価額・含み損益をリアルタイムで確認。",
};

export default async function PortfolioPage() {
  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) redirect("/login");

  const items = await getPortfolio(userId).catch(() => []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-[10px] uppercase tracking-widest text-navy/40 mb-1">
            <Link href="/" className="hover:text-navy transition">Home</Link>
            <span className="mx-1">/</span>
            <span>Portfolio</span>
          </nav>
          <h1 className="text-2xl font-semibold text-navy">My Portfolio</h1>
          <p className="mt-0.5 text-sm text-navy/50">保有カードの評価額・含み損益</p>
        </div>
        <Link
          href="/cards"
          className="border border-navy/20 px-4 py-2 text-xs font-medium uppercase tracking-widest text-navy/60 hover:border-navy/50 hover:text-navy transition"
        >
          + カードを追加
        </Link>
      </div>

      <PortfolioClient items={items} />
    </div>
  );
}
