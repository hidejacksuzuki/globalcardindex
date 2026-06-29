"use client";

import { useState, useTransition, useEffect, useRef } from "react";

type Props = {
  cardId:        string;
  cardName:      string;
  existingItem?: {
    id:           string;
    quantity:     number;
    avgBuyPrice:  number | null;
    memo:         string | null;
  } | null;
  onClose:  () => void;
  onSaved:  () => void;
};

export function AddPortfolioModal({ cardId, cardName, existingItem, onClose, onSaved }: Props) {
  const [quantity,    setQuantity]    = useState(String(existingItem?.quantity ?? 1));
  const [avgBuyPrice, setAvgBuyPrice] = useState(
    existingItem?.avgBuyPrice != null ? String(existingItem.avgBuyPrice) : ""
  );
  const [memo,        setMemo]        = useState(existingItem?.memo ?? "");
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = () => {
    const qty   = Math.max(1, parseInt(quantity, 10) || 1);
    const price = avgBuyPrice.trim() !== "" ? parseFloat(avgBuyPrice) : null;
    if (price !== null && (isNaN(price) || price < 0)) {
      setError("価格は0以上の数値を入力してください");
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        if (existingItem) {
          const res = await fetch(`/api/v1/portfolio/${existingItem.id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ quantity: qty, avgBuyPrice: price, memo: memo.trim() || null }),
          });
          if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed");
        } else {
          const res = await fetch("/api/v1/portfolio", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ cardId, quantity: qty, avgBuyPrice: price, memo: memo.trim() || null }),
          });
          if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed");
        }
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-sm bg-white border border-navy/10 shadow-xl sm:rounded-none">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-navy/5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-navy/40">
              {existingItem ? "編集" : "追加"}
            </p>
            <h2 className="text-sm font-semibold text-navy mt-0.5 truncate max-w-[240px]">
              {cardName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-navy/30 hover:text-navy transition text-xl leading-none p-1"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* フォーム */}
        <div className="px-5 py-4 space-y-4">
          {/* 枚数 */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">
              枚数 <span className="text-navy/30 normal-case tracking-normal">(必須)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(String(Math.max(1, parseInt(quantity, 10) - 1)))}
                className="w-8 h-8 border border-navy/15 text-navy/50 hover:border-navy/40 hover:text-navy transition flex items-center justify-center text-base"
              >
                −
              </button>
              <input
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-16 border border-navy/15 px-2 py-1.5 text-center text-sm text-navy outline-none focus:border-navy/50 transition"
              />
              <button
                type="button"
                onClick={() => setQuantity(String((parseInt(quantity, 10) || 1) + 1))}
                className="w-8 h-8 border border-navy/15 text-navy/50 hover:border-navy/40 hover:text-navy transition flex items-center justify-center text-base"
              >
                ＋
              </button>
            </div>
          </div>

          {/* 取得単価 */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">
              取得単価 <span className="text-navy/30 normal-case tracking-normal">(任意・後で編集可)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy/30">¥</span>
              <input
                type="number"
                min="0"
                step="any"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                placeholder="例: 3500"
                className="w-full border border-navy/15 pl-7 pr-3 py-2 text-sm text-navy outline-none focus:border-navy/50 transition placeholder-navy/20"
              />
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">
              メモ <span className="text-navy/30 normal-case tracking-normal">(任意)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={200}
              placeholder="例: PSA10、初版、海外版"
              className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/50 transition placeholder-navy/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* アクション */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-navy/15 py-2.5 text-xs text-navy/50 hover:text-navy hover:border-navy/40 transition"
          >
            キャンセル
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="flex-1 border border-navy bg-navy py-2.5 text-xs font-semibold text-white hover:bg-navy/80 transition disabled:opacity-40"
          >
            {isPending ? "保存中…" : existingItem ? "更新" : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}
