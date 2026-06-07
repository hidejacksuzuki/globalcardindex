/**
 * RecapView.tsx
 * /daily と /daily/[date] で共有する Recap 描画コンポーネント。
 * Server Component 対応（async 不要、純粋な描画ロジックのみ）。
 */

import Link              from "next/link";
import type { DailyRecap } from "@gci/core";
import type { MarketCard } from "@gci/core";
import { getGame }         from "@gci/core";
import { PriceCell }       from "@/components/market/PriceCell";

type Props = {
  recap:    DailyRecap;
  isLive?:  boolean;   // true = /daily (live), false = /daily/[date] (archive)
  archiveDates?: string[];  // 最近のアーカイブ日付一覧（サイドナビ用）
};

export function RecapView({ recap, isLive = false, archiveDates = [] }: Props) {
  const displayDate = new Date(recap.date + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  return (
    <div className="space-y-10">
      {/* ── ヘッダー ──────────────────────────────────────────────── */}
      <header className="border-b border-navy/10 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-navy/40">
              Daily Market Recap
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-navy">{displayDate}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isLive ? (
              <span className="rounded-sm border border-navy/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-navy/35">
                1h cache
              </span>
            ) : (
              <span className="rounded-sm border border-navy/15 bg-navy/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-widest text-navy/50">
                Archive
              </span>
            )}
            {!isLive && (
              <Link
                href="/daily"
                className="rounded-sm border border-navy/15 px-2.5 py-1 text-[10px] uppercase tracking-widest text-navy/40 hover:text-navy transition"
              >
                Latest →
              </Link>
            )}
          </div>
        </div>

        {/* Editor Note */}
        <blockquote className="mt-4 border-l-2 border-navy/20 pl-4 text-sm text-navy/60 italic leading-relaxed">
          {recap.editorNote}
        </blockquote>
      </header>

      {/* ── GCI 指数 ─────────────────────────────────────────────── */}
      {recap.index && (
        <section>
          <SectionTitle title="GCI 総合指数" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <IndexCard label="現在値"  value={recap.index.value.toFixed(2)}  color="text-navy" />
            <IndexCard
              label="24h 変動"
              value={
                recap.index.change24h !== null
                  ? `${recap.index.change24h > 0 ? "+" : ""}${recap.index.change24h.toFixed(2)}%`
                  : "—"
              }
              color={
                recap.index.change24h === null   ? "text-navy/40" :
                recap.index.change24h > 0        ? "text-gold-700" : "text-red-600"
              }
            />
            <IndexCard
              label="前回比"
              value={`${recap.index.changeRate > 0 ? "+" : ""}${recap.index.changeRate.toFixed(2)}%`}
              color={recap.index.changeRate > 0 ? "text-gold-600" : recap.index.changeRate < 0 ? "text-red-500" : "text-navy/40"}
            />
            <IndexCard
              label={isLive ? "更新" : "記録時刻"}
              value={new Date(recap.index.updatedAt).toLocaleTimeString("ja-JP", {
                hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
              })}
              color="text-navy/50"
            />
          </div>
        </section>
      )}

      {/* ── Top Gainers ───────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Top Gainers"
          badge="▲ 7d"
          badgeClass="border-gold-300 bg-gold-50 text-gold-700"
          link={isLive ? { href: "/gainers", label: "全件 →" } : undefined}
        />
        <MiniTable cards={recap.gainers} variant="gainers" />
      </section>

      {/* ── Top Losers ────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Top Losers"
          badge="▼ 7d"
          badgeClass="border-red-200 bg-red-50 text-red-600"
          link={isLive ? { href: "/losers", label: "全件 →" } : undefined}
        />
        <MiniTable cards={recap.losers} variant="losers" />
      </section>

      {/* ── Volume Spikes ─────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Volume Spikes"
          badge="⚡ 24h"
          badgeClass="border-purple-200 bg-purple-50 text-purple-600"
        />
        {recap.spikes.length > 0 ? (
          <MiniTable cards={recap.spikes} variant="volume" />
        ) : (
          <div className="border border-navy/10 bg-white px-4 py-6 text-sm text-navy/40 text-center">
            この日は大きな出品量スパイクは検知されませんでした。
          </div>
        )}
      </section>

      {/* ── Trending ──────────────────────────────────────────────── */}
      <section>
        <SectionTitle
          title="Trending"
          badge="🔥"
          badgeClass="border-navy/15 bg-navy/5 text-navy/60"
          link={isLive ? { href: "/trending", label: "全件 →" } : undefined}
        />
        <MiniTable cards={recap.trending} variant="trending" />
      </section>

      {/* ── アーカイブ一覧（最近30日） ─────────────────────────────── */}
      {archiveDates.length > 0 && (
        <section>
          <SectionTitle title="Archive" />
          <div className="flex flex-wrap gap-2">
            {archiveDates.map((d) => (
              <Link
                key={d}
                href={`/daily/${d}`}
                className={[
                  "rounded-sm border px-3 py-1.5 text-xs tabular-nums transition",
                  d === recap.date
                    ? "border-navy/30 bg-navy text-white"
                    : "border-navy/10 text-navy/50 hover:border-navy/30 hover:text-navy",
                ].join(" ")}
              >
                {d}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── フッター ──────────────────────────────────────────────── */}
      <footer className="border-t border-navy/10 pt-6 text-xs text-navy/35 flex items-center justify-between flex-wrap gap-3">
        <span>
          Generated {new Date(recap.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </span>
        <div className="flex gap-4">
          <Link href="/gainers"  className="hover:text-navy transition">Gainers</Link>
          <Link href="/losers"   className="hover:text-navy transition">Losers</Link>
          <Link href="/trending" className="hover:text-navy transition">Trending</Link>
          <Link href="/indices"  className="hover:text-navy transition">Indices</Link>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------
// 共通サブコンポーネント
// ----------------------------------------------------------------

function SectionTitle({
  title, badge, badgeClass = "", link,
}: {
  title:       string;
  badge?:      string;
  badgeClass?: string;
  link?:       { href: string; label: string };
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-xs uppercase tracking-widest text-navy/50">{title}</h2>
      {badge && (
        <span className={`rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-widest ${badgeClass}`}>
          {badge}
        </span>
      )}
      {link && (
        <Link href={link.href} className="ml-auto text-xs text-navy/35 hover:text-navy transition underline underline-offset-2">
          {link.label}
        </Link>
      )}
    </div>
  );
}

function IndexCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-navy/10 bg-white px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

type MiniVariant = "gainers" | "losers" | "volume" | "trending";

export function MiniTable({ cards, variant }: { cards: MarketCard[]; variant: MiniVariant }) {
  if (cards.length === 0) {
    return (
      <div className="border border-navy/10 bg-white px-4 py-6 text-sm text-navy/40 text-center">
        データがまだありません。
      </div>
    );
  }
  return (
    <div className="border border-navy/10 bg-white divide-y divide-navy/5">
      {cards.map((card, i) => (
        <MiniRow key={card.cardId} card={card} rank={i + 1} variant={variant} />
      ))}
    </div>
  );
}

function MiniRow({ card, rank, variant }: { card: MarketCard; rank: number; variant: MiniVariant }) {
  const game = card.game ? getGame(card.game) : null;
  const href = card.slug ? `/cards/${card.slug}` : `/cards/${card.cardId}`;
  const accentLeft =
    variant === "gainers" ? "border-l-2 border-l-gold-400" :
    variant === "losers"  ? "border-l-2 border-l-red-400"  :
    variant === "volume"  ? "border-l-2 border-l-purple-400" : "";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-navy/[0.02] ${accentLeft}`}>
      <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-navy/25">{rank}</span>
      {game && <span className="shrink-0 text-sm">{game.emoji}</span>}
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate font-medium text-navy text-sm hover:underline underline-offset-2">
          {card.cardName}
        </Link>
        <p className="truncate text-[10px] text-navy/40">{card.setName} · {card.rarity}</p>
      </div>
      <span className="shrink-0 tabular-nums text-sm font-medium text-navy">
        <PriceCell price={card.latestPrice} storedCurrency={card.currency} />
      </span>
      {(variant === "gainers" || variant === "losers" || variant === "trending") && (
        <ChangeChip value={card.change7d} />
      )}
      {variant === "volume" && (
        <span className="shrink-0 text-xs tabular-nums text-purple-600 font-semibold">
          {card.count24h}<span className="font-normal text-navy/30 ml-0.5">件</span>
        </span>
      )}
    </div>
  );
}

function ChangeChip({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-navy/25 w-14 text-right shrink-0">—</span>;
  const isPos  = value > 0;
  const color  = isPos ? "text-gold-700" : value < 0 ? "text-red-600" : "text-navy/40";
  const prefix = isPos ? "▲" : value < 0 ? "▼" : "";
  return (
    <span className={`shrink-0 tabular-nums text-xs font-semibold w-14 text-right ${color}`}>
      {prefix}{Math.abs(value).toFixed(1)}%
    </span>
  );
}
