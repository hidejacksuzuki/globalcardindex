"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

type FeedbackType = "bug" | "request_card" | "feature_request" | "other";

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "bug",              label: "不具合報告" },
  { value: "request_card",     label: "カードのリクエスト" },
  { value: "feature_request",  label: "機能要望" },
  { value: "other",            label: "その他" },
];

export function BetaFeedbackWidget() {
  const pathname = usePathname();
  const [open,      setOpen]      = useState(false);
  const [type,      setType]      = useState<FeedbackType>("bug");
  const [message,   setMessage]   = useState("");
  const [cardName,  setCardName]  = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setType("bug");
    setMessage("");
    setCardName("");
    setError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = () => {
    if (!message.trim()) {
      setError("内容を入力してください");
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/v1/feedback", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            message:     message.trim(),
            cardName:    cardName.trim() || null,
            currentPath: pathname,
          }),
        });
        if (!res.ok) throw new Error();
        close();
        setToast("フィードバックを送信しました。ありがとうございます！");
      } catch {
        setError("送信に失敗しました。時間をおいて再度お試しください");
      }
    });
  };

  return (
    <>
      {/* Fixed corner button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="β Feedback"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-navy bg-navy px-3 sm:px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-navy/85 transition"
      >
        <span className="text-sm leading-none">💬</span>
        {/* モバイルではアイコンのみ表示し、コンテンツへの被りを最小化 */}
        <span className="hidden sm:inline">β Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full sm:max-w-md bg-white border border-navy/10 shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-navy/5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-navy/40">β Feedback</p>
                <h2 className="text-sm font-semibold text-navy mt-0.5">ご意見をお聞かせください</h2>
              </div>
              <button onClick={close} className="text-navy/30 hover:text-navy transition text-xl leading-none p-1" aria-label="閉じる">
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">種類</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/50 transition bg-white"
                >
                  {TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {type === "request_card" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">
                    カード名 <span className="text-navy/30 normal-case tracking-normal">(任意)</span>
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    maxLength={200}
                    placeholder="例: リザードンex SAR"
                    className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/50 transition placeholder-navy/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-navy/50 mb-1.5">
                  内容 <span className="text-navy/30 normal-case tracking-normal">(必須)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="困っていること・欲しい機能・気づいた不具合などをご記入ください"
                  className="w-full border border-navy/15 px-3 py-2 text-sm text-navy outline-none focus:border-navy/50 transition placeholder-navy/20 resize-none"
                />
              </div>

              <p className="text-[10px] text-navy/30">
                送信ページ: {pathname}
              </p>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={close}
                className="flex-1 border border-navy/15 py-2.5 text-xs text-navy/50 hover:text-navy hover:border-navy/40 transition"
              >
                キャンセル
              </button>
              <button
                onClick={submit}
                disabled={isPending}
                className="flex-1 border border-navy bg-navy py-2.5 text-xs font-semibold text-white hover:bg-navy/80 transition disabled:opacity-40"
              >
                {isPending ? "送信中…" : "送信"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
