"use client";

import { useState, useTransition } from "react";
import { Toast }                   from "@/components/ui/Toast";

type Props = {
  cardId:       string;
  inPortfolio:  boolean;
};

export function QuickPortfolioButton({ cardId, inPortfolio: initial }: Props) {
  const [done,       setDone]       = useState(initial);
  const [toast,      setToast]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-600 whitespace-nowrap">
        <span>✓</span>
        <span>Portfolio</span>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          startTransition(async () => {
            try {
              const res = await fetch("/api/v1/portfolio", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ cardId, quantity: 1 }),
              });
              if (!res.ok) throw new Error();
              setDone(true);
              setToast("Portfolioに追加しました");
            } catch {
              setToast("エラーが発生しました");
            }
          });
        }}
        disabled={isPending}
        className="inline-flex items-center gap-0.5 text-[10px] text-navy/40 hover:text-navy transition disabled:opacity-40 whitespace-nowrap"
        title="Portfolioに追加"
      >
        {isPending ? "…" : "+ Portfolio"}
      </button>
      {toast && (
        <Toast
          message={toast}
          type={toast.includes("エラー") ? "error" : "success"}
          action={toast.includes("エラー") ? undefined : { label: "Portfolioを見る", href: "/portfolio" }}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
