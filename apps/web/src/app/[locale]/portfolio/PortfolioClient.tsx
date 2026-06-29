"use client";

import { useState, useTransition } from "react";
import Link                         from "next/link";
import type { PortfolioItem }       from "@gci/core";
import { AddPortfolioModal }        from "@/components/portfolio/AddPortfolioModal";
import { Toast }                    from "@/components/ui/Toast";

type Props = { items: PortfolioItem[] };

function fmt(val: number | null, currency: string | null = "JPY") {
  if (val === null) return "—";
  return new Intl.NumberFormat("ja-JP", {
    style:               "currency",
    currency:            currency ?? "JPY",
    maximumFractionDigits: 0,
  }).format(val);
}

function pct(val: number | null) {
  if (val === null) return null;
  return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
}

export function PortfolioClient({ items: initialItems }: Props) {
  const [items,      setItems]      = useState<PortfolioItem[]>(initialItems);
  const [editItem,   setEditItem]   = useState<PortfolioItem | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const [_p,         startTransition] = useTransition();

  const remove = (id: string, name: string) => {
    if (!confirm(`「${name}」をポートフォリオから削除しますか？`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/portfolio/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setToast("削除しました");
      }
    });
  };

  const refresh = async (msg = "Portfolio を更新しました") => {
    const res  = await fetch("/api/v1/portfolio");
    const data = await res.json() as { ok: boolean; items?: PortfolioItem[] };
    if (data.ok && data.items) setItems(data.items);
    setEditItem(null);
    setToast(msg);
  };

  // サマリー計算
  const hasValue   = items.some((i) => i.evaluatedValue !== null);
  const hasCost    = items.some((i) => i.cost !== null);
  const hasGain    = items.some((i) => i.unrealizedGain !== null);
  const totalQty   = items.reduce((s, i) => s + i.quantity, 0);
  const totalVal   = items.reduce((s, i) => s + (i.evaluatedValue ?? 0), 0);
  const totalCost  = items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const totalGain  = items.reduce((s, i) => s + (i.unrealizedGain ?? 0), 0);
  const totalGainPct = hasCost && totalCost > 0 ? (totalGain / totalCost) * 100 : null;

  if (items.length === 0) {
    return (
      <div className="border border-navy/10 bg-white p-12 text-center space-y-4">
        <p className="text-4xl">📦</p>
        <div>
          <p className="text-sm font-medium text-navy">ポートフォリオが空です</p>
          <p className="mt-1 text-xs text-navy/40 leading-relaxed">
            カード詳細ページの「+ Portfolioに追加」ボタンから登録できます。
          </p>
        </div>
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 border border-navy/20 px-5 py-2.5 text-xs uppercase tracking-widest text-navy hover:border-navy/50 hover:bg-navy/5 transition"
        >
          カードを探す →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* ── Summary ─────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "保有種類",  value: `${items.length}種 / ${totalQty}枚`, cls: "text-navy" },
          { label: "総評価額",  value: hasValue  ? fmt(totalVal)  : "—",   cls: "text-navy font-semibold" },
          { label: "取得コスト", value: hasCost   ? fmt(totalCost) : "—",   cls: "text-navy/60" },
          {
            label: "含み損益",
            value: hasGain
              ? `${totalGain >= 0 ? "+" : ""}${fmt(totalGain)}${totalGainPct !== null ? ` (${pct(totalGainPct)})` : ""}`
              : "—",
            cls: !hasGain ? "text-navy/30" : totalGain >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold",
          },
        ].map(({ label, value, cls }) => (
          <div key={label} className="border border-navy/10 bg-white p-4">
            <dt className="text-[10px] uppercase tracking-widest text-navy/40">{label}</dt>
            <dd className={`mt-1.5 text-base tabular-nums leading-tight ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="border border-navy/10 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-navy/5 bg-navy/[0.02]">
              {["カード", "枚数", "取得単価", "現在値", "評価額", "含み損益", ""].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {items.map((item) => {
              const gain    = item.unrealizedGain;
              const gainPct = item.unrealizedGainPct;
              return (
                <tr key={item.id} className="hover:bg-navy/[0.015] transition">
                  <td className="px-4 py-3 min-w-[160px]">
                    <div>
                      {item.slug ? (
                        <Link
                          href={`/cards/${item.slug}`}
                          className="font-medium text-navy hover:underline underline-offset-2 truncate block max-w-[200px]"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-navy truncate block max-w-[200px]">{item.name}</span>
                      )}
                      <span className="text-[10px] text-navy/40 truncate block max-w-[200px]">
                        {item.setName}
                        {item.memo ? ` · ${item.memo}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-navy/70 whitespace-nowrap">{item.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-navy/50 whitespace-nowrap">
                    {item.avgBuyPrice !== null ? fmt(item.avgBuyPrice, item.currency) : <span className="text-navy/25">—</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-navy/70 whitespace-nowrap">
                    {item.currentPrice !== null ? fmt(item.currentPrice, item.currency) : <span className="text-navy/25">—</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-navy whitespace-nowrap">
                    {item.evaluatedValue !== null ? fmt(item.evaluatedValue, item.currency) : <span className="text-navy/25">—</span>}
                  </td>
                  <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${
                    gain === null ? "text-navy/25" : gain >= 0 ? "text-green-700" : "text-red-600"
                  }`}>
                    {gain !== null ? (
                      <span>
                        {gain >= 0 ? "+" : ""}{fmt(gain, item.currency)}
                        {gainPct !== null && (
                          <span className="ml-1 text-[11px] font-normal">({pct(gainPct)})</span>
                        )}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditItem(item)}
                      className="text-[11px] text-navy/35 hover:text-navy transition mr-3 underline underline-offset-2"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => remove(item.id, item.name)}
                      className="text-[11px] text-red-400 hover:text-red-600 transition underline underline-offset-2"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── モーダル ─────────────────────────────────────────────── */}
      {editItem && (
        <AddPortfolioModal
          cardId={editItem.cardId}
          cardName={editItem.name}
          existingItem={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => refresh("Portfolio を更新しました")}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
