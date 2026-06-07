"use client";

/**
 * ウォッチリスト再生成ボタン（クライアントコンポーネント）
 * POST /api/v1/admin/watchlist を呼び出し、DB から watchlist.csv を再生成する。
 */

import { useState } from "react";

export function RegenerateButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ rows?: number; cards?: number; error?: string } | null>(null);

  const run = async (dry = false) => {
    setState("loading");
    setResult(null);
    try {
      const res  = await fetch("/api/v1/admin/watchlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dry }),
      });
      const data = await res.json();
      if (data.ok) {
        setState("done");
        setResult({ rows: data.rows, cards: data.cards });
      } else {
        setState("error");
        setResult({ error: data.error });
      }
    } catch (e) {
      setState("error");
      setResult({ error: String(e) });
    }
    setTimeout(() => setState("idle"), 5000);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => run(false)}
        disabled={state === "loading"}
        className="rounded-lg border border-navy/20 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy/5 disabled:opacity-50 transition"
      >
        {state === "loading" ? "生成中…" : "🔄 Watchlist 再生成"}
      </button>
      <button
        onClick={() => run(true)}
        disabled={state === "loading"}
        className="rounded-lg border border-navy/10 bg-navy/[0.03] px-3 py-1.5 text-xs text-navy/50 hover:bg-navy/10 disabled:opacity-50 transition"
      >
        プレビュー
      </button>
      {state === "done" && result && (
        <span className="text-xs text-green-700">
          ✓ {result.cards}カード → {result.rows}行
        </span>
      )}
      {state === "error" && result && (
        <span className="text-xs text-red-600">✗ {result.error}</span>
      )}
    </div>
  );
}
