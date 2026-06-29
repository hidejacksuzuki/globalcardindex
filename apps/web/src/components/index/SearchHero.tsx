"use client";

import { useState, useRef } from "react";
import { useRouter }         from "next/navigation";

export function SearchHero() {
  const [query,   setQuery]   = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);
  const router                = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) { inputRef.current?.focus(); return; }
    router.push(`/cards?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="border border-navy/10 bg-white p-8 sm:p-12 space-y-6">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-navy/40">Card Price Intelligence</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-navy leading-snug">
          あなたのカード、今いくら？
        </h1>
        <p className="text-sm text-navy/55 leading-relaxed max-w-lg">
          日本のトレーディングカード市場を追跡する価格指数プラットフォーム。
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2 max-w-xl">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カード名・セット名で検索…"
          className="flex-1 border border-navy/20 px-4 py-3 text-sm text-navy placeholder-navy/30 outline-none focus:border-navy/60 transition"
        />
        <button
          type="submit"
          className="border border-navy bg-navy px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-navy/80 transition shrink-0"
        >
          検索
        </button>
      </form>
    </section>
  );
}
