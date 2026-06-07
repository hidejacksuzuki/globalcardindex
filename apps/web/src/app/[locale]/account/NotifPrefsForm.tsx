"use client";

/**
 * NotifPrefsForm
 *
 * Toggles for notification preferences.
 * Calls PATCH /api/v1/account/prefs on change.
 */

import { useState, useTransition } from "react";

type Prefs = {
  marketAlerts: boolean;
  weeklyRecap:  boolean;
  newsletter:   boolean;
};

export function NotifPrefsForm({ prefs: initial }: { prefs: Prefs }) {
  const [prefs,   setPrefs]   = useState<Prefs>(initial);
  const [status,  setStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const update = (key: keyof Prefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setStatus("saving");

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/account/prefs", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ [key]: value }),
        });
        setStatus(res.ok ? "saved" : "error");
        if (!res.ok) setPrefs(prefs);  // revert on error
        // Reset to idle after 2s
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
        setPrefs(prefs);
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  };

  const ITEMS: { key: keyof Prefs; label: string; description: string }[] = [
    {
      key:         "marketAlerts",
      label:       "価格アラート",
      description: "ウォッチリストのカードが 15% 以上動いたときにメールでお知らせします。",
    },
    {
      key:         "weeklyRecap",
      label:       "週次まとめ",
      description: "毎週月曜日に急騰・急落カードと市場サマリーをお届けします。",
    },
    {
      key:         "newsletter",
      label:       "デイリーニュースレター",
      description: "毎日の市場まとめをメールでお届けします（配信頻度: 高）。",
    },
  ];

  return (
    <div className="divide-y divide-navy/5 border border-navy/10 bg-white">
      {ITEMS.map((item) => (
        <label
          key={item.key}
          className="flex cursor-pointer items-start gap-4 px-5 py-4 hover:bg-navy/[0.02] transition"
        >
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-medium text-navy">{item.label}</p>
            <p className="text-xs text-navy/50 mt-0.5">{item.description}</p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={prefs[item.key]}
              onClick={() => update(item.key, !prefs[item.key])}
              disabled={pending}
              className={[
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50",
                prefs[item.key] ? "bg-navy" : "bg-navy/20",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
                  prefs[item.key] ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </button>
          </div>
        </label>
      ))}

      {/* Save status */}
      <div className="px-5 py-3 text-right">
        <span className={`text-xs transition ${
          status === "saved"  ? "text-green-600" :
          status === "error"  ? "text-red-500" :
          status === "saving" ? "text-navy/40" :
          "text-transparent"
        }`}>
          {status === "saved"  ? "✓ 保存しました" :
           status === "error"  ? "保存に失敗しました" :
           status === "saving" ? "保存中…" :
           "·"}
        </span>
      </div>
    </div>
  );
}
