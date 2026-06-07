import type { Metadata } from "next";
import Link               from "next/link";
import { getTopLosers }   from "@gci/core";
import { TrendTable }     from "@/components/market/TrendTable";

export const revalidate = 300;

export const metadata: Metadata = {
  title:       "Top Losers | Global Card Index",
  description: "7日間で最も値下がりしたトレカランキング。ポケカ・ワンピース・遊戯王の暴落カードをリアルタイム追跡。",
};

export default async function LosersPage() {
  const cards = await getTopLosers(50).catch(() => []);

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-navy">Top Losers</h1>
              <span className="rounded-sm border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-red-600">
                7d ▼
              </span>
            </div>
            <p className="mt-1 text-sm text-navy/50">
              直近7日間で最も価格下落したカードのランキング。
            </p>
          </div>
          <MarketNav active="losers" />
        </div>
      </header>

      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="1位の下落率"
            value={cards[0]?.change7d !== null ? `${cards[0].change7d!.toFixed(1)}%` : "—"}
            color="text-red-600"
          />
          <StatCard
            label="ランクイン数"
            value={`${cards.length} cards`}
            color="text-navy"
          />
          <StatCard
            label="平均下落率"
            value={
              cards.filter((c) => c.change7d !== null).length > 0
                ? `${(
                    cards.reduce((s, c) => s + (c.change7d ?? 0), 0) /
                    cards.filter((c) => c.change7d !== null).length
                  ).toFixed(1)}%`
                : "—"
            }
            color="text-red-500"
          />
        </div>
      )}

      <TrendTable cards={cards} mode="losers" />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-navy/10 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function MarketNav({ active }: { active: "trending" | "gainers" | "losers" }) {
  const links = [
    { href: "/trending", label: "🔥 Trending",  id: "trending" as const },
    { href: "/gainers",  label: "▲ Gainers",    id: "gainers"  as const },
    { href: "/losers",   label: "▼ Losers",     id: "losers"   as const },
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
