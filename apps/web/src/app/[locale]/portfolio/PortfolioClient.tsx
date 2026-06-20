"use client";

import { useState, useTransition } from "react";
import Link                         from "next/link";
import type { PortfolioItem }       from "@gci/core";
import { AddPortfolioModal }        from "@/components/portfolio/AddPortfolioModal";

type Props = {
  items: PortfolioItem[];
};

function fmt(val: number | null, currency: string | null = "JPY") {
  if (val === null) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style:    "currency",
    currency: currency ?? "JPY",
    maximumFractionDigits: 0,
  }).format(val);
}

function sign(val: number | null) {
  if (val === null) return "";
  return val >= 0 ? "+" : "";
}

export function PortfolioClient({ items: initialItems }: Props) {
  const [items,      setItems]      = useState<PortfolioItem[]>(initialItems);
  const [editItem,   setEditItem]   = useState<PortfolioItem | null>(null);
  const [_pending,   startTransition] = useTransition();

  const remove = (id: string) => {
    if (!confirm("このカードをポートフォリオから削除しますか？")) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/portfolio/${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    });
  };

  const refresh = async () => {
    const res  = await fetch("/api/v1/portfolio");
    const data = await res.json() as { ok: boolean; items?: PortfolioItem[] };
    if (data.ok && data.items) setItems(data.items);
    setEditItem(null);
  };

  const totalValue    = items.reduce((s, i) => s + (i.evaluatedValue ?? 0), 0);
  const totalCost     = items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const unrealized    = items.some((i) => i.unrealizedGain !== null)
    ? items.reduce((s, i) => s + (i.unrealizedGain ?? 0), 0)
    : null;
  const unrealizedPct = unrealized !== null && totalCost > 0
    ? (unrealized / totalCost) * 100
    : null;

  if (items.length === 0) {
    return (
      <div className="border border-navy/10 bg-white p-10 text-center text-sm text-navy/40">
        ポートフォリオにカードがありません。
        <br />
        <Link href="/cards" className="mt-2 inline-block text-navy underline underline-offset-2 hover:text-navy/70 transition">
          カードを探す →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Summary */}
      <section className="border border-navy/10 bg-white p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">保有カード</dt>
          <dd className="mt-1 text-lg font-semibold text-navy tabular-nums">{items.length}種</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">総評価額</dt>
          <dd className="mt-1 text-lg font-semibold text-navy tabular-nums">
            {items.some((i) => i.evaluatedValue !== null) ? fmt(totalValue) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">取得コスト</dt>
          <dd className="mt-1 text-lg tabular-nums text-navy/60">
            {items.some((i) => i.cost !== null) ? fmt(totalCost) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-navy/40">含み損益</dt>
          <dd className={`mt-1 text-lg tabular-nums font-semibold ${
            unrealized === null ? "text-navy/30" :
            unrealized >= 0    ? "text-green-700" : "text-red-600"
          }`}>
            {unrealized !== null ? (
              <>
                {sign(unrealized)}{fmt(unrealized)}
                {unrealizedPct !== null && (
                  <span className="ml-1 text-sm font-normal">
                    ({sign(unrealizedPct)}{unrealizedPct.toFixed(1)}%)
                  </span>
                )}
              </>
            ) : "—"}
          </dd>
        </div>
      </section>

      {/* Table */}
      <div className="border border-navy/10 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy/5">
              {["カード", "セット", "枚数", "取得価格", "現在値", "評価額", "含み損益", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-navy/5 last:border-0 hover:bg-navy/[0.02] transition">
                <td className="px-4 py-3">
                  {item.slug ? (
                    <Link href={`/cards/${item.slug}`} className="font-medium text-navy hover:underline underline-offset-2">
                      {item.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-navy">{item.name}</span>
                  )}
                  {item.memo && (
                    <span className="ml-2 text-[10px] text-navy/40">{item.memo}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-navy/50 whitespace-nowrap">{item.setName}</td>
                <td className="px-4 py-3 tabular-nums text-navy/70">{item.quantity}</td>
                <td className="px-4 py-3 tabular-nums text-navy/60">
                  {item.avgBuyPrice !== null ? fmt(item.avgBuyPrice, item.currency) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-navy/70">
                  {item.currentPrice !== null ? fmt(item.currentPrice, item.currency) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium text-navy">
                  {item.evaluatedValue !== null ? fmt(item.evaluatedValue, item.currency) : "—"}
                </td>
                <td className={`px-4 py-3 tabular-nums font-medium ${
                  item.unrealizedGain === null ? "text-navy/30" :
                  item.unrealizedGain >= 0     ? "text-green-700" : "text-red-600"
                }`}>
                  {item.unrealizedGain !== null ? (
                    <>
                      {sign(item.unrealizedGain)}{fmt(item.unrealizedGain, item.currency)}
                      {item.unrealizedGainPct !== null && (
                        <span className="ml-1 text-[11px]">
                          ({sign(item.unrealizedGainPct)}{item.unrealizedGainPct.toFixed(1)}%)
                        </span>
                      )}
                    </>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditItem(item)}
                    className="mr-2 text-[11px] text-navy/40 hover:text-navy transition underline underline-offset-2"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-[11px] text-red-400 hover:text-red-600 transition underline underline-offset-2"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editItem && (
        <AddPortfolioModal
          cardId={editItem.cardId}
          cardName={editItem.name}
          existingItem={{
            id:          editItem.id,
            quantity:    editItem.quantity,
            avgBuyPrice: editItem.avgBuyPrice,
            memo:        editItem.memo,
          }}
          onClose={() => setEditItem(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
