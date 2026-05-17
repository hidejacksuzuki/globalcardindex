/**
 * TrendTable.tsx
 * Trending / Gainers / Losers / Volume Spikes 共通テーブルコンポーネント。
 * mode で列表示を切り替え。
 */

import Link              from "next/link";
import type { MarketCard } from "@/actions/market";
import { getGame }       from "@/lib/seo/games";
import { formatPrice }   from "@/lib/utils/formatPrice";

export type TrendMode = "trending" | "gainers" | "losers" | "volume";

type Props = {
  cards: MarketCard[];
  mode:  TrendMode;
};

export function TrendTable({ cards, mode }: Props) {
  if (cards.length === 0) {
    return (
      <div className="border border-navy/10 bg-white p-12 text-center">
        <p className="text-3xl">📊</p>
        <p className="mt-3 text-sm font-medium text-navy">データがまだありません</p>
        <p className="mt-1 text-xs text-navy/50">
          価格データが蓄積されると自動で表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
          <tr>
            <th className="px-3 py-3 text-right text-navy/25 w-8">#</th>
            <th className="px-4 py-3">Card</th>
            <th className="px-4 py-3 hidden sm:table-cell">Set</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">7d</th>
            {mode === "trending" && (
              <th className="px-4 py-3 text-right hidden md:table-cell">Score</th>
            )}
            {mode === "volume" && (
              <th className="px-4 py-3 text-right">24h / avg</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {cards.map((card, i) => (
            <TrendRow key={card.cardId} card={card} rank={i + 1} mode={mode} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------

function TrendRow({ card, rank, mode }: { card: MarketCard; rank: number; mode: TrendMode }) {
  const game = card.game ? getGame(card.game) : null;
  const href = card.slug ? `/cards/${card.slug}` : `/cards/${card.cardId}`;

  const accentClass =
    mode === "gainers" ? "border-l-2 border-l-gold-400" :
    mode === "losers"  ? "border-l-2 border-l-red-400"  :
    mode === "volume"  ? "border-l-2 border-l-purple-400" : "";

  return (
    <tr className={`hover:bg-navy/[0.02] ${accentClass}`}>
      {/* ランク */}
      <td className="px-3 py-3 text-right text-[11px] tabular-nums text-navy/25">
        {rank}
      </td>

      {/* カード名 */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-2 min-w-0">
          {game && (
            <span className="mt-0.5 text-sm shrink-0" title={game.name}>
              {game.emoji}
            </span>
          )}
          <div className="min-w-0">
            <Link
              href={href}
              className="font-medium text-navy hover:underline underline-offset-2 truncate block"
            >
              {card.cardName}
            </Link>
            <p className="text-[10px] text-navy/40">
              {card.rarity} · {card.condition}
            </p>
          </div>
        </div>
      </td>

      {/* セット */}
      <td className="px-4 py-3 text-xs text-navy/50 hidden sm:table-cell max-w-[200px]">
        <Link
          href={`/sets/${encodeURIComponent(card.setName)}`}
          className="hover:underline underline-offset-2 truncate block"
        >
          {card.setName}
        </Link>
      </td>

      {/* 価格 */}
      <td className="px-4 py-3 text-right tabular-nums font-medium text-navy whitespace-nowrap">
        {card.latestPrice !== null && card.currency
          ? formatPrice(card.latestPrice, card.currency)
          : <span className="text-navy/25">—</span>}
      </td>

      {/* 7d 変動 */}
      <td className="px-4 py-3 text-right">
        <Change7d value={card.change7d} abs={card.change7dAbs} currency={card.currency} />
      </td>

      {/* Trending: score */}
      {mode === "trending" && (
        <td className="px-4 py-3 text-right tabular-nums text-xs text-navy/35 hidden md:table-cell">
          {card.trendScore.toFixed(1)}
        </td>
      )}

      {/* Volume: 24h / avg */}
      {mode === "volume" && (
        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
          <span className="text-purple-600 font-semibold">{card.count24h}</span>
          <span className="text-navy/30 text-xs ml-1">
            / {(card.count7d / 7).toFixed(1)}
          </span>
        </td>
      )}
    </tr>
  );
}

// ----------------------------------------------------------------

function Change7d({
  value,
  abs,
  currency,
}: {
  value:    number | null;
  abs:      number | null;
  currency: string | null;
}) {
  if (value === null) return <span className="text-navy/25 text-xs">—</span>;

  const isPos  = value > 0;
  const isNeg  = value < 0;
  const color  = isPos ? "text-gold-700" : isNeg ? "text-red-600" : "text-navy/40";
  const prefix = isPos ? "▲" : isNeg ? "▼" : "";
  const absStr = abs !== null && currency
    ? formatPrice(Math.abs(abs), currency)
    : null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`tabular-nums text-sm font-semibold ${color}`}>
        {prefix}{Math.abs(value).toFixed(1)}%
      </span>
      {absStr && (
        <span className={`tabular-nums text-[10px] opacity-55 ${color}`}>
          {isPos ? "+" : "-"}{absStr}
        </span>
      )}
    </div>
  );
}
