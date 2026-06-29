"use client";

import { useState, useRef } from "react";
import { useRouter }         from "next/navigation";

const POPULAR = ["ピカチュウ", "リーリエ", "ブラッキー", "ナンジャモ", "ミモザ"];

type Props = {
  lastUpdated?: string | null;
};

export function SearchHero({ lastUpdated }: Props) {
  const [query, setQuery] = useState("");
  const inputRef          = useRef<HTMLInputElement>(null);
  const router            = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) { inputRef.current?.focus(); return; }
    router.push(`/cards?q=${encodeURIComponent(q)}`);
  };

  const pick = (label: string) => {
    router.push(`/cards?q=${encodeURIComponent(label)}`);
  };

  return (
    /* Full-bleed within layout container */
    <div className="-mx-6 -mt-10 bg-gradient-to-br from-[#0b1a3e] via-[#0f2255] to-[#132d6b] px-6 py-12 sm:px-10 sm:py-16">
      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-center max-w-5xl">
        {/* Left */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight">
              あなたのカード、<br className="sm:hidden" />今いくら？
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              価格データから算出した最新相場を、誰でも、透明に。
            </p>
          </div>

          {/* Search */}
          <form onSubmit={submit} className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="カード名・セット名・カード番号で検索"
                className="w-full bg-white/10 border border-white/20 pl-9 pr-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/50 focus:bg-white/15 transition rounded-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-[#2b6ef5] hover:bg-[#1d5cd4] text-white px-5 py-3 text-sm font-semibold transition rounded-sm shrink-0"
            >
              検索
            </button>
          </form>

          {/* Popular chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-white/30">人気の検索:</span>
            {POPULAR.map((label) => (
              <button
                key={label}
                onClick={() => pick(label)}
                className="border border-white/20 bg-white/8 hover:bg-white/15 px-3 py-1 text-xs text-white/70 hover:text-white transition rounded-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right — stats badge */}
        <div className="hidden lg:flex flex-col items-end gap-3">
          <div className="border border-white/15 bg-white/5 rounded-sm px-5 py-4 text-right space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-white/30">市場データは毎日更新</p>
            {lastUpdated && (
              <>
                <p className="text-[10px] text-white/30">最終更新</p>
                <p className="text-xs text-white/60 tabular-nums">{lastUpdated}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
