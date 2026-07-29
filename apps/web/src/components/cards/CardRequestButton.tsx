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
import { useT }     from "@/i18n/context";

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
  const t = useT().cardRequest;
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
        setErrorMsg(json.error ?? t.errSubmit);
        setState("error");
      }
    } catch {
      setErrorMsg(t.errNetwork);
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-green-700 ${className}`}>
        <span>✓</span> {t.sent}
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
        <span>＋</span> {t.openBtn}
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
                <h2 className="text-base font-semibold text-navy">{t.modalTitle}</h2>
                <p className="mt-0.5 text-xs text-navy/50">
                  {t.modalDesc}
                </p>
              </div>
              <button
                onClick={close}
                className="text-navy/30 hover:text-navy/60 transition text-lg leading-none"
                aria-label={t.close}
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              {/* Name (required) */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  {t.fieldName} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder={t.phName}
                  className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Set + Game (row) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                    {t.fieldSet}
                  </label>
                  <input
                    type="text"
                    value={setName_}
                    onChange={(e) => setSetName(e.target.value)}
                    maxLength={80}
                    placeholder={t.phSet}
                    className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                    {t.fieldGame}
                  </label>
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  >
                    <option value="">{t.gameNone}</option>
                    <option value="pokemon">{t.gamePokemon}</option>
                    <option value="onepiece">{t.gameOnepiece}</option>
                    <option value="yugioh">{t.gameYugioh}</option>
                    <option value="mtg">MTG</option>
                    <option value="other">{t.gameOther}</option>
                  </select>
                </div>
              </div>

              {/* Rarity */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  {t.fieldRarity}
                </label>
                <input
                  type="text"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                  maxLength={40}
                  placeholder={t.phRarity}
                  className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  {t.fieldNote}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={400}
                  rows={2}
                  placeholder={t.phNote}
                  className="w-full resize-none rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                />
              </div>

              {/* Requested by */}
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">
                  {t.fieldFrom}
                </label>
                <input
                  type="text"
                  value={reqBy}
                  onChange={(e) => setReqBy(e.target.value)}
                  maxLength={60}
                  placeholder={t.phFrom}
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
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={state === "submitting" || !name.trim()}
                  className="rounded border border-navy bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy/90 disabled:opacity-40"
                >
                  {state === "submitting" ? t.submitting : t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
