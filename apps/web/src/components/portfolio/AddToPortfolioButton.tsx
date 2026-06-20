"use client";

import { useState } from "react";
import { AddPortfolioModal } from "./AddPortfolioModal";

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

export function AddToPortfolioButton({ cardId, cardName, initialItem }: Props) {
  const [item,        setItem]        = useState<PortfolioCard | null | undefined>(initialItem);
  const [showModal,   setShowModal]   = useState(false);

  const inPortfolio = item != null;

  const handleSaved = async () => {
    setShowModal(false);
    // Re-fetch current state from API
    try {
      const res  = await fetch("/api/v1/portfolio");
      const data = await res.json() as { ok: boolean; items?: Array<{ cardId: string; id: string; quantity: number; avgBuyPrice: number | null; memo: string | null }> };
      if (data.ok && data.items) {
        const found = data.items.find((i) => i.cardId === cardId);
        setItem(found ?? null);
      }
    } catch {
      // fallback: assume success
      if (!inPortfolio) setItem({ id: "", quantity: 1, avgBuyPrice: null, memo: null });
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={[
          "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5",
          "text-xs uppercase tracking-widest transition-all",
          inPortfolio
            ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-navy/20 bg-white text-navy/60 hover:border-navy/40 hover:text-navy",
        ].join(" ")}
      >
        <span className="text-base leading-none">{inPortfolio ? "✓" : "+"}</span>
        <span>{inPortfolio ? "Portfolio" : "Add to Portfolio"}</span>
      </button>

      {showModal && (
        <AddPortfolioModal
          cardId={cardId}
          cardName={cardName}
          existingItem={item ?? null}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
