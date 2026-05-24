"use client";

import { useState } from "react";

export function ImportWatchlistButton() {
  const [busy, setBusy]   = useState(false);
  const [msg,  setMsg]    = useState<string | null>(null);
  const [isErr, setIsErr] = useState(false);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    setIsErr(false);
    try {
      const res  = await fetch("/api/v1/cards/import-watchlist", { method: "POST" });
      const json = await res.json() as { ok: boolean; created?: number; skipped?: number; total?: number; error?: string };
      if (json.ok) {
        setMsg(`✓ 完了 — 新規登録: ${json.created}件 / スキップ: ${json.skipped}件 / 合計: ${json.total}件`);
      } else {
        setIsErr(true);
        setMsg(`✗ エラー: ${json.error}`);
      }
    } catch (e) {
      setIsErr(true);
      setMsg(`✗ 通信エラー: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded border border-navy bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "登録中…" : "Watchlist からカード登録"}
      </button>
      {msg && (
        <span className={`text-xs ${isErr ? "text-red-600" : "text-green-700"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
