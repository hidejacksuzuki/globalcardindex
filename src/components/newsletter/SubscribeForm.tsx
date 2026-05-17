"use client";

/**
 * SubscribeForm
 *
 * /newsletter ページのメール登録フォーム。
 * Server Action (subscribe) を呼び出し、
 * 結果に応じて UI をインタラクティブに更新する。
 */

import { useState, useTransition } from "react";
import { subscribe }               from "@/actions/newsletter";

type UIState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export function SubscribeForm() {
  const [state, setState]   = useState<UIState>({ phase: "idle" });
  const [isPending, start]  = useTransition();

  const loading = isPending || state.phase === "loading";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ phase: "loading" });

    start(async () => {
      const result = await subscribe(fd);
      if (result.ok) {
        setState({ phase: "success" });
      } else {
        setState({ phase: "error", message: result.error });
      }
    });
  }

  // ── 送信成功 ──────────────────────────────────────────────────
  if (state.phase === "success") {
    return (
      <div className="border border-navy/10 bg-white p-8 text-center">
        <p className="text-3xl mb-4">📬</p>
        <h2 className="text-lg font-semibold text-navy mb-2">確認メールを送りました</h2>
        <p className="text-sm text-navy/60 leading-relaxed">
          受信トレイをご確認ください。<br />
          確認リンクをクリックすると購読が有効になります。
        </p>
        <p className="mt-4 text-xs text-navy/30">
          メールが届かない場合は迷惑メールフォルダをご確認ください。
        </p>
      </div>
    );
  }

  // ── フォーム ──────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="source" value="newsletter-page" />

      <div>
        <label htmlFor="email" className="sr-only">メールアドレス</label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          disabled={loading}
          className={[
            "w-full border px-4 py-3 text-sm text-navy placeholder:text-navy/30",
            "focus:outline-none focus:ring-2 focus:ring-navy/20",
            "disabled:opacity-50",
            state.phase === "error"
              ? "border-red-400 bg-red-50"
              : "border-navy/20 bg-white",
          ].join(" ")}
        />
        {state.phase === "error" && (
          <p className="mt-1.5 text-xs text-red-600">{state.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className={[
          "w-full border border-navy bg-navy px-6 py-3 text-sm font-medium",
          "tracking-wide text-white transition",
          "hover:bg-navy/90 active:bg-navy/80",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {loading ? "送信中…" : "無料で購読する"}
      </button>
    </form>
  );
}
