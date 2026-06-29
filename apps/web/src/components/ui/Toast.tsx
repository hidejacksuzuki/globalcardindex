"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type Props = {
  message:   string;
  type?:     ToastType;
  duration?: number;
  onDone?:   () => void;
  action?:   { label: string; href: string };
};

export function Toast({ message, type = "success", duration = 3500, onDone, action }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  if (!visible) return null;

  const styles: Record<ToastType, string> = {
    success: "bg-navy text-white border-navy",
    error:   "bg-red-600 text-white border-red-600",
    info:    "bg-white text-navy border-navy/20",
  };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 border px-4 py-3 shadow-lg text-sm whitespace-nowrap ${styles[type]}`}>
      {type === "success" && <span className="text-base leading-none">✓</span>}
      <span>{message}</span>
      {action && (
        <a
          href={action.href}
          className="ml-2 underline underline-offset-2 opacity-80 hover:opacity-100 transition"
        >
          {action.label} →
        </a>
      )}
      <button
        onClick={() => { setVisible(false); onDone?.(); }}
        className="ml-2 opacity-50 hover:opacity-100 transition text-base leading-none"
        aria-label="閉じる"
      >
        ✕
      </button>
    </div>
  );
}
