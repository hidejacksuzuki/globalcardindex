"use client";

import { useState, useTransition } from "react";
import Link                         from "next/link";
import { AddPortfolioModal }        from "./AddPortfolioModal";
import { Toast }                    from "@/components/ui/Toast";

type PortfolioCard = {
  id:          string;
  quantity:    number;
  avgBuyPrice: number | null;
  memo:        string | null;
};

type Props = {
  cardId:       string;
  cardName:     string;
  userId:       string;
  initialItem?: PortfolioCard | null;
};

export function AddToPortfolioButton({ cardId, cardName, userId: _userId, initialItem }: Props) {
  const [item,        setItem]        = useState<PortfolioCard | null | undefined>(initialItem);
  const [showModal,   setShowModal]   = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const inPortfolio = item != null;

  // Quick Add: 1クリックで quantity=1 即登録
  const quickAdd = () => {
    startTransition(async () => {
      try {
        const res  = await fetch("/api/v1/portfolio", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ cardId, quantity: 1 }),
        });
        const data = await res.json() as { ok: boolean; item?: PortfolioCard };
        if (!res.ok || !data.ok) throw new Error();
        setItem(data.item ?? { id: "", quantity: 1, avgBuyPrice: null, memo: null });
        setToast("Portfolioに追加しました");
      } catch {
        setToast("エラーが発生しました");
      }
    });
  };

  const handleModalSaved = async (toastMsg = "Portfolio を更新しました") => {
    setShowModal(false);
    // 最新状態を取得
    try {
      const res  = await fetch("/api/v1/portfolio");
      const data = await res.json() as { ok: boolean; items?: Array<PortfolioCard & { cardId: string }> };
      if (data.ok && data.items) {
        const found = data.items.find((i) => i.cardId === cardId);
        setItem(found ?? null);
      }
    } catch { /* ignore */ }
    setToast(toastMsg);
  };

  if (!inPortfolio) {
    return (
      <>
        <div className="flex items-center gap-2">
          {/* Quick Add */}
          <button
            onClick={quickAdd}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-sm border border-navy/20 bg-white px-3 py-1.5 text-xs uppercase tracking-widest text-navy/60 hover:border-navy hover:bg-navy hover:text-white transition-all disabled:opacity-40"
          >
            {isPending ? (
              <span className="text-base leading-none animate-spin">⊙</span>
            ) : (
              <span className="text-base leading-none">+</span>
            )}
            <span>Portfolioに追加</span>
          </button>
          {/* 詳細入力リンク */}
          <button
            onClick={() => setShowModal(true)}
            className="text-[11px] text-navy/35 hover:text-navy transition underline underline-offset-2"
          >
            詳細入力
          </button>
        </div>

        {showModal && (
          <AddPortfolioModal
            cardId={cardId}
            cardName={cardName}
            existingItem={null}
            onClose={() => setShowModal(false)}
            onSaved={() => handleModalSaved("Portfolioに追加しました")}
          />
        )}

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

  // 登録済み
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-green-400 bg-green-50 px-3 py-1.5 text-xs uppercase tracking-widest text-green-700">
          <span className="text-base leading-none">✓</span>
          <span>Portfolio登録済み</span>
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="text-[11px] text-navy/35 hover:text-navy transition underline underline-offset-2"
        >
          編集
        </button>
        <Link
          href="/portfolio"
          className="text-[11px] text-navy/35 hover:text-navy transition underline underline-offset-2"
        >
          Portfolioを見る
        </Link>
      </div>

      {showModal && item && (
        <AddPortfolioModal
          cardId={cardId}
          cardName={cardName}
          existingItem={item}
          onClose={() => setShowModal(false)}
          onSaved={() => handleModalSaved("Portfolio を更新しました")}
        />
      )}

      {toast && (
        <Toast
          message={toast}
          type={toast.includes("エラー") ? "error" : "success"}
          action={{ label: "Portfolioを見る", href: "/portfolio" }}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}
