"use client";

/**
 * CardRequestButton
 *
 * A small inline button that opens a modal form allowing users to
 * request a card to be added to the GCI catalog.
 *
 * Usage:
 *   <CardRequestButton defaultName="Charizard ex" />
 *   <CardRequestButton />
 */

import { useState } from "react";

type Props = {
  defaultName?: string;
  className?:   string;
};

type FormState = "idle" | "open" | "submitting" | "success" | "error";

export function CardRequestButton({ defaultName = "", className = "" }: Props) {
  const [state,     setState]     = useState<FormState>("idle");
  const [name,      setName]      = useState(defaultName);
  const [setName_,  setSetName]   = useState("");
  const [game,      setGame]      = useState("");
  const [rarity,    setRarity]    = useState("");
  const [reqBy,     setReqBy]     = useState("");
  const [note,      setNote]      = useState("");
  const [errorMsg,  setErrorMsg]  = useState("");

  const open  = () => { setState("open"); setErrorMsg(""); };
  const close = () => {
    setState("idle");
    // reset only non-defaultName fields
    setSetName(""); setGame(""); setRarity(""); setReqBy(""); setNote(""); setErrorMsg("");
    if (!defaultName) setName("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setState("submitting");
    try {
      const res = await fetch("/api/v1/card-requests", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        name.trim(),
          setName:     setName_.trim() || undefined,
          game:        game.trim()     || undefined,
          rarity:      rarity.trim()   || undefined,
          requestedBy: reqBy.trim()    || undefined,
          note:        note.trim()     || undefined,
        }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) {
        setState("success");
      } else {
        setErrorMsg(json.error ?? "送信に失敗しました。");
        setState("error");
      }
    } catch {
      setErrorMsg("ネットワークエラーが発生しました。");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-green-700 ${className}`}>
        <span>✓</span> リクエストを送信しました。ありがとうございます！
      </span>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={open}
        className={`inline-flex items-center gap-1.5 rounded border border-navy/20 px-3 py-1.5 text-xs text-navy/60 transition hover:border-navy/40 hover:text-navy ${className}`}
      >
        <span>＋</span> このカードをリクエスト
      </button>

      {/* Modal backdrop */}
      {(state === "open" || state === "submitting" || state === "error") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="w-full max-w-md rounded-lg border border-navy/10 bg-white p-6 shadow-xl">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-navy">カード追加リクエスト</h2>
                <p className="mt-0.5 text-xs text-navy/50">
                  追跡してほしいカードをリクエストできます。
                </p>
              </div>
              <button
                onClick={close}
                className="text-navy/30 hover:text-navy/60 transition text-lg leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              {/* Name (required) */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  カード名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="例: リザードン ex"
                  className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Set + Game (row) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                    セット名
                  </label>
                  <input
                    type="text"
                    value={setName_}
                    onChange={(e) => setSetName(e.target.value)}
                    maxLength={80}
                    placeholder="例: SV4a シャイニー"
                    className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                    ゲーム
                  </label>
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  >
                    <option value="">未指定</option>
                    <option value="pokemon">ポケカ</option>
                    <option value="onepiece">ワンピース</option>
                    <option value="yugioh">遊戯王</option>
                    <option value="mtg">MTG</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>

              {/* Rarity */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  レアリティ
                </label>
                <input
                  type="text"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                  maxLength={40}
                  placeholder="例: SAR, SR, PSR"
                  className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  備考・理由
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={400}
                  rows={2}
                  placeholder="任意。追加してほしい理由など。"
                  className="w-full resize-none rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Requested by */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  お名前（任意・匿名可）
                </label>
                <input
                  type="text"
                  value={reqBy}
                  onChange={(e) => setReqBy(e.target.value)}
                  maxLength={60}
                  placeholder="Discord名など"
                  className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Error */}
              {state === "error" && errorMsg && (
                <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                  {errorMsg}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="rounded border border-navy/20 px-4 py-2 text-xs text-navy/60 transition hover:bg-navy/5"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={state === "submitting" || !name.trim()}
                  className="rounded border border-navy bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy/90 disabled:opacity-40"
                >
                  {state === "submitting" ? "送信中…" : "リクエスト送信"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
