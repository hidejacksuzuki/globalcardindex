"use client";

/**
 * MigrateBanner
 *
 * Shown on /account when the user has an anonymous cookie-based watchlist
 * that hasn't been migrated to their DB watchlist yet.
 *
 * Calls POST /api/v1/watchlist/migrate, then refreshes the page.
 */

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";

type Props = {
  sessionId: string;
};

export function MigrateBanner({ sessionId }: Props) {
  const router                       = useRouter();
  const [status, setStatus]          = useState<"idle" | "migrating" | "done" | "error">("idle");
  const [migratedCount, setMigrated] = useState<number>(0);
  const [pending, startTransition]   = useTransition();

  const migrate = () => {
    setStatus("migrating");

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/watchlist/migrate", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sessionId }),
        });

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data = await res.json() as { migrated: number };
        setMigrated(data.migrated);
        setStatus("done");

        // Refresh page to show the migrated cards in the watchlist section
        setTimeout(() => router.refresh(), 1200);
      } catch {
        setStatus("error");
      }
    });
  };

  if (status === "done") {
    return (
      <div className="rounded border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
        ✓ {migratedCount}件のカードをウォッチリストに移行しました。
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900">
            ログイン前のウォッチリストが見つかりました
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            アカウントに移行すると、どのデバイスからでもアクセスでき、価格アラートも届くようになります。
          </p>
          {status === "error" && (
            <p className="mt-1.5 text-xs text-red-600">
              移行できませんでした。もう一度お試しください。
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={migrate}
          disabled={pending || status === "migrating"}
          className="shrink-0 rounded border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-200 disabled:opacity-50"
        >
          {status === "migrating" ? "移行中…" : "引き継ぐ"}
        </button>
      </div>
    </div>
  );
}
