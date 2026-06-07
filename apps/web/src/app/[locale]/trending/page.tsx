import type { Metadata }    from "next";
import Link                   from "next/link";
import { getTrendingCards }   from "@gci/core";
import { TrendTable }         from "@/components/market/TrendTable";

export const revalidate = 300; // 5分 ISR

export const metadata: Metadata = {
  title:       "Trending Cards | Global Card Index",
  description: "今注目されているトレカの相場ランキング。価格上昇・出品急増を複合スコアでリアルタイム集計。",
};

export default async function TrendingPage() {
  const cards = await getTrendingCards(50).catch(() => []);

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-navy">Trending</h1>
              <span className="rounded-sm border border-navy/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-navy/40">
                Live · 5m cache
              </span>
            </div>
            <p className="mt-1 text-sm text-navy/50">
              価格モメンタム × 出品量 × データ品質の複合スコアで算出。
            </p>
          </div>
          <MarketNav active="trending" />
        </div>
      </header>

      {/* スコア計算式の注記 */}
      <div className="border border-navy/10 bg-navy/[0.02] px-4 py-3 text-xs text-navy/50">
        trendScore = 価格上昇率 × 0.5 + log(24h出品数) × 2.0 + データ品質ボーナス
      </div>

      <TrendTable cards={cards} mode="trending" />
    </div>
  );
}

// ----------------------------------------------------------------

function MarketNav({ active }: { active: "trending" | "gainers" | "losers" | "volume" }) {
  const links: { href: string; label: string; id: typeof active }[] = [
    { href: "/trending", label: "🔥 Trending",  id: "trending" },
    { href: "/gainers",  label: "▲ Gainers",    id: "gainers"  },
    { href: "/losers",   label: "▼ Losers",     id: "losers"   },
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => (
        <Link
          key={l.id}
          href={l.href}
          className={[
            "px-3 py-1.5 text-xs uppercase tracking-widest transition rounded-sm",
            l.id === active
              ? "bg-navy text-white"
              : "border border-navy/15 text-navy/50 hover:border-navy/30 hover:text-navy",
          ].join(" ")}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
