"use client";

import { useState, useTransition, useEffect, useRef } from "react";

type Props = {
  cardId:       string;
  cardName:     string;
  existingItem?: {
    id:           string;
    quantity:     number;
    avgBuyPrice:  number | null;
    memo:         string | null;
  } | null;
  onClose:      () => void;
  onSaved:      () => void;
};

export function AddPortfolioModal({ cardId, cardName, existingItem, onClose, onSaved }: Props) {
  const [quantity,    setQuantity]    = useState(String(existingItem?.quantity ?? 1));
  const [avgBuyPrice, setAvgBuyPrice] = useState(existingItem?.avgBuyPrice != null ? String(existingItem.avgBuyPrice) : "");
  const [memo,        setMemo]        = useState(existingItem?.memo ?? "");
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = () => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const price = avgBuyPrice.trim() !== "" ? parseFloat(avgBuyPrice) : null;

    startTransition(async () => {
      setError(null);
      try {
        if (existingItem) {
          const res = await fetch(`/api/v1/portfolio/${existingItem.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ quantity: qty, avgBuyPrice: price, memo: memo.trim() || null }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        } else {
          const res = await fetch("/api/v1/portfolio", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ cardId, quantity: qty, avgBuyPrice: price, memo: memo.trim() || null }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
        }
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white border border-navy/10 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-navy">
            {existingItem ? "ポートフォリオを編集" : "ポートフォリオに追加"}
          </h2>
          <button
            onClick={onClose}
            className="text-navy/30 hover:text-navy transition text-lg leading-none"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-navy/50 mb-5 truncate">{cardName}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1">
              枚数
            </label>
            <input
              ref={firstInputRef}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/40 rounded-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1">
              取得価格（任意）
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={avgBuyPrice}
              onChange={(e) => setAvgBuyPrice(e.target.value)}
              placeholder="例: 3500"
              className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/40 rounded-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1">
              メモ（任意）
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={200}
              placeholder="例: PSA10"
              className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/40 rounded-sm"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="border border-navy/20 px-4 py-2 text-xs text-navy/60 hover:text-navy transition rounded-sm"
          >
            キャンセル
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="border border-navy bg-navy px-4 py-2 text-xs text-white hover:bg-navy/80 transition disabled:opacity-50 rounded-sm"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
