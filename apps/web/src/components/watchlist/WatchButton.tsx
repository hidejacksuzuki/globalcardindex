"use client";

/**
 * WatchButton — dual-mode watchlist toggle
 *
 * - Logged-in  (userId provided): calls addToUserWatchlist / removeFromUserWatchlist
 *              → persisted in UserWatchlistItem (DB)
 * - Anonymous  (no userId):       calls addToWatchlist / removeFromWatchlist
 *              → stored in cookie-based Watchlist table
 */

import { useState, useTransition }                        from "react";
import { addToWatchlist, removeFromWatchlist }            from "@gci/core";
import { addToUserWatchlist, removeFromUserWatchlist }    from "@gci/core";
import { trackWatchlist }                                 from "@/components/analytics/PlausibleAnalytics";

type Props = {
  cardId:    string;
  slug?:     string;      // for analytics labeling
  isWatched: boolean;
  userId?:   string;      // present when the visitor is authenticated
};

export function WatchButton({ cardId, slug, isWatched: initialWatched, userId }: Props) {
  const [watched,   setWatched]   = useState(initialWatched);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !watched;
    setWatched(next); // オプティミスティック更新
    trackWatchlist(next ? "add" : "remove", slug ?? cardId);

    startTransition(async () => {
      try {
        if (userId) {
          // 認証済み: DB永続化
          if (next) {
            await addToUserWatchlist(userId, cardId);
          } else {
            await removeFromUserWatchlist(userId, cardId);
          }
        } else {
          // 匿名: cookieベース
          if (next) {
            await addToWatchlist(cardId);
          } else {
            await removeFromWatchlist(cardId);
          }
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
      <span>{watched ? "ウォッチ中" : "ウォッチ"}</span>
    </button>
  );
}
