"use client";

import { useState } from "react";

type CardRow = {
  id:          string;
  name:        string;
  setName:     string;
  rarity:      string;
  condition:   string;
  slug:        string | null;
  game:        string | null;
  priceCount:  number;
  latestPrice: number | null;
  latestAt:    Date   | null;
  createdAt:   Date;
};

export function CardInventoryTable({ cards }: { cards: CardRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? cards.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.setName.toLowerCase().includes(q) ||
          c.rarity.toLowerCase().includes(q) ||
          (c.game ?? "").toLowerCase().includes(q) ||
          c.condition.toLowerCase().includes(q)
        );
      })
    : cards;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xs uppercase tracking-widest text-navy/40">
          Card Inventory ({filtered.length.toLocaleString()}
          {query ? ` / ${cards.length.toLocaleString()}` : ""} total)
        </h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カード名・セット・レアリティで絞り込み..."
          className="w-64 rounded border border-navy/20 px-3 py-1.5 text-xs text-navy placeholder:text-navy/30 outline-none focus:border-navy/50"
        />
      </div>

      {cards.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          No cards yet. Import a CSV to get started.
        </p>
      ) : filtered.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          「{query}」に一致するカードが見つかりません。
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Rarity</th>
                <th className="px-4 py-3">Cond</th>
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3 text-right">Prices</th>
                <th className="px-4 py-3 text-right">Latest ¥</th>
                <th className="px-4 py-3">Last Observed</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={[
                    "hover:bg-navy/[0.02]",
                    c.priceCount === 0 ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                  <td className="px-4 py-3 text-navy/60">{c.setName}</td>
                  <td className="px-4 py-3 text-navy/60">{c.rarity}</td>
                  <td className="px-4 py-3 text-navy/50">{c.condition}</td>
                  <td className="px-4 py-3 text-navy/40 text-xs">
                    {c.game ?? <span className="text-navy/20">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.priceCount === 0 ? (
                      <span className="text-amber-500">0</span>
                    ) : (
                      <span className="text-navy">{c.priceCount.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                    {c.latestPrice != null
                      ? `¥${c.latestPrice.toLocaleString()}`
                      : <span className="text-navy/25">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-navy/40 tabular-nums">
                    {c.latestAt
                      ? new Date(c.latestAt).toLocaleDateString("ja-JP")
                      : <span className="text-navy/25">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-navy/40">
                    {c.slug ?? <span className="text-navy/25">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/admin/cards/${c.id}/collect`}
                      className="rounded bg-navy px-3 py-1 text-xs font-medium text-white hover:bg-navy/80"
                    >
                      Collect
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
