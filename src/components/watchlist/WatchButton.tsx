"use client";

import { useState, useTransition } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/actions/watchlist";

type Props = {
  cardId:    string;
  isWatched: boolean;
};

export function WatchButton({ cardId, isWatched: initialWatched }: Props) {
  const [watched, setWatched]   = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !watched;
    setWatched(next); // オプティミスティック更新
    startTransition(async () => {
      try {
        if (next) {
          await addToWatchlist(cardId);
        } else {
          await removeFromWatchlist(cardId);
        }
      } catch {
        setWatched(!next); // ロールバック
      }
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-label={watched ? "ウォッチリストから削除" : "ウォッチリストに追加"}
      className={[
        "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5",
        "text-xs uppercase tracking-widest transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        watched
          ? "border-gold-400 bg-gold-50 text-gold-700 hover:bg-gold-100"
          : "border-navy/20 bg-white text-navy/60 hover:border-navy/40 hover:text-navy",
      ].join(" ")}
    >
      <span className="text-base leading-none">{watched ? "★" : "☆"}</span>
      <span>{watched ? "Watching" : "Watch"}</span>
    </button>
  );
}
