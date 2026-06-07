"use client";

/**
 * /admin/cards/add
 *
 * Pokemon TCG API (api.pokemontcg.io) からカードを検索し、
 * 選択したカードを DB に登録 + data/watchlist.csv に追記する。
 *
 * フロー:
 *   1. カード名を入力 → pokemontcg.io で検索
 *   2. 結果一覧からチェックボックスで選択
 *   3. コンディション・価格レンジを指定して「追加」
 *   4. POST /api/v1/cards/bulk-add → DB & watchlist.csv 更新
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type PtcgCard = {
  id:     string;
  name:   string;
  number: string;
  rarity: string | null;
  set: {
    id:   string;
    name: string;
    series: string;
  };
  images: { small: string; large: string };
};

type SelectedCard = PtcgCard & {
  conditions: string[];
  minPrice:   number;
  maxPrice:   number;
  game:       string;
};

const DEFAULT_CONDITIONS = ["NM", "LP"];
const ALL_CONDITIONS     = ["NM", "LP", "MP", "HP"];

// ── レアリティ別スマートデフォルト ────────────────────────────────────────────

type RarityDefault = { minPrice: number; maxPrice: number; conditions: string[] };

const RARITY_DEFAULTS: Record<string, RarityDefault> = {
  SAR: { minPrice: 3000,  maxPrice: 200000, conditions: ["NM", "LP"] },
  SSR: { minPrice: 3000,  maxPrice: 200000, conditions: ["NM", "LP"] },
  CSR: { minPrice: 3000,  maxPrice: 150000, conditions: ["NM", "LP"] },
  HR:  { minPrice: 3000,  maxPrice: 150000, conditions: ["NM", "LP"] },
  UR:  { minPrice: 3000,  maxPrice: 150000, conditions: ["NM", "LP"] },
  SR:  { minPrice: 1000,  maxPrice:  80000, conditions: ["NM", "LP"] },
  SER: { minPrice: 1000,  maxPrice:  80000, conditions: ["NM", "LP"] },
  AR:  { minPrice: 1000,  maxPrice:  50000, conditions: ["NM", "LP"] },
  CHR: { minPrice: 1000,  maxPrice:  50000, conditions: ["NM", "LP"] },
  RRR: { minPrice:  800,  maxPrice:  30000, conditions: ["NM", "LP"] },
  ACE: { minPrice:  800,  maxPrice:  30000, conditions: ["NM", "LP"] },
  RR:  { minPrice:  300,  maxPrice:  10000, conditions: ["NM", "LP", "MP"] },
  R:   { minPrice:  100,  maxPrice:   5000, conditions: ["NM", "LP", "MP"] },
  PR:  { minPrice:  100,  maxPrice:   5000, conditions: ["NM", "LP", "MP"] },
};

function getRarityDefault(rarity: string | null): RarityDefault {
  if (!rarity) return { minPrice: 500, maxPrice: 50000, conditions: ["NM", "LP"] };
  const key = rarity.toUpperCase().trim();
  return RARITY_DEFAULTS[key] ?? { minPrice: 500, maxPrice: 50000, conditions: ["NM", "LP"] };
}

// レアリティラベル色
function rarityColor(rarity: string | null): string {
  const r = rarity?.toUpperCase() ?? "";
  if (["SAR","SSR","CSR","HR","UR"].some((x) => r.includes(x))) return "bg-yellow-100 text-yellow-800";
  if (["SR","SER","AR","CHR"].some((x) => r === x)) return "bg-purple-100 text-purple-700";
  if (["RRR","ACE"].some((x) => r === x)) return "bg-blue-100 text-blue-700";
  if (r === "RR") return "bg-sky-100 text-sky-700";
  return "bg-navy/10 text-navy/50";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AddCardsPage() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<PtcgCard[]>([]);
  const [selected, setSelected] = useState<Map<string, SelectedCard>>(new Map());
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [status,   setStatus]   = useState<{ ok: boolean; msg: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 検索 ──────────────────────────────────────────────────────────────────

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    try {
      // pokemontcg.io は無料・無認証で利用可能
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(q.trim())}*"&pageSize=40&orderBy=set.releaseDate`,
        { signal: abortRef.current.signal }
      );
      const data = await res.json();
      setResults(data.data ?? []);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQuery = (v: string) => {
    setQuery(v);
    if (v.length >= 2) search(v);
    else setResults([]);
  };

  // ── 選択トグル ────────────────────────────────────────────────────────────

  const toggle = (card: PtcgCard) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(card.id)) {
        next.delete(card.id);
      } else {
        const def = getRarityDefault(card.rarity);
        next.set(card.id, {
          ...card,
          conditions: [...def.conditions],
          minPrice:   def.minPrice,
          maxPrice:   def.maxPrice,
          game:       "pokemon",
        });
      }
      return next;
    });
  };

  const updateSelected = (id: string, patch: Partial<SelectedCard>) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur  = next.get(id);
      if (cur) next.set(id, { ...cur, ...patch });
      return next;
    });
  };

  const toggleCondition = (id: string, cond: string) => {
    const cur = selected.get(id);
    if (!cur) return;
    const conds = cur.conditions.includes(cond)
      ? cur.conditions.filter((c) => c !== cond)
      : [...cur.conditions, cond];
    updateSelected(id, { conditions: conds });
  };

  // ── セット全件選択 ────────────────────────────────────────────────────────

  const selectSet = async (setId: string, setName: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250`
      );
      const data = await res.json();
      const cards: PtcgCard[] = data.data ?? [];
      setResults(cards);
      // 全件を選択済みに追加
      setSelected((prev) => {
        const next = new Map(prev);
        for (const card of cards) {
          if (!next.has(card.id)) {
            const def = getRarityDefault(card.rarity);
            next.set(card.id, {
              ...card,
              conditions: [...def.conditions],
              minPrice:   def.minPrice,
              maxPrice:   def.maxPrice,
              game:       "pokemon",
            });
          }
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  // ── DB + watchlist.csv に保存 ─────────────────────────────────────────────

  const save = async () => {
    if (!selected.size) return;
    setSaving(true);
    setStatus(null);

    try {
      const payload = [...selected.values()].map((c) => ({
        game:       c.game,
        name:       c.name,
        setName:    c.set.name,
        rarity:     c.rarity ?? "Unknown",
        conditions: c.conditions,
        minPrice:   c.minPrice,
        maxPrice:   c.maxPrice,
        ptcgId:     c.id,
        number:     c.number,
      }));

      const res  = await fetch("/api/v1/cards/bulk-add", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cards: payload }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus({ ok: true, msg: `✓ ${data.created}件追加、${data.skipped}件スキップ（重複）、watchlist.csvを更新しました` });
        setSelected(new Map());
      } else {
        setStatus({ ok: false, msg: data.error ?? "エラー" });
      }
    } catch (e) {
      setStatus({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Cards</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">カード追加</h1>
        <p className="mt-1 text-sm text-navy/50">
          Pokemon TCG API で検索 → 選択 → DB & watchlist.csv に一括追加
        </p>
      </header>

      {/* ── 検索ボックス ── */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
          placeholder="カード名を入力（例: ナンジャモ、リザードン）"
          className="flex-1 rounded-lg border border-navy/20 px-4 py-2.5 text-sm focus:border-navy focus:outline-none"
        />
        <button
          onClick={() => search(query)}
          disabled={loading}
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy/80 disabled:opacity-50"
        >
          {loading ? "検索中…" : "検索"}
        </button>
      </div>

      {/* ── 検索結果 ── */}
      {results.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-navy/40">
              検索結果 ({results.length}件)
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => {
                  setSelected((prev) => {
                    const next = new Map(prev);
                    results.forEach((c) => {
                      if (!next.has(c.id)) {
                        next.set(c.id, { ...c, conditions: [...DEFAULT_CONDITIONS], minPrice: 500, maxPrice: 100000, game: "pokemon" });
                      }
                    });
                    return next;
                  });
                }}
                className="rounded bg-navy/10 px-2.5 py-1 text-navy hover:bg-navy/20"
              >
                全選択
              </button>
              <button
                onClick={() => {
                  setSelected((prev) => {
                    const next = new Map(prev);
                    results.forEach((c) => next.delete(c.id));
                    return next;
                  });
                }}
                className="rounded bg-navy/10 px-2.5 py-1 text-navy hover:bg-navy/20"
              >
                全解除
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((card) => {
              const isSelected = selected.has(card.id);
              return (
                <button
                  key={card.id}
                  onClick={() => toggle(card)}
                  className={[
                    "rounded-lg border-2 p-2 text-left transition",
                    isSelected
                      ? "border-navy bg-navy/5"
                      : "border-navy/10 bg-white hover:border-navy/30",
                  ].join(" ")}
                >
                  {card.images?.small && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.images.small}
                      alt={card.name}
                      className="mb-2 w-full rounded"
                    />
                  )}
                  <p className="text-xs font-semibold text-navy leading-tight">{card.name}</p>
                  <p className="mt-0.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${rarityColor(card.rarity)}`}>
                      {card.rarity ?? "—"}
                    </span>
                  </p>
                  <p className="text-[10px] text-navy/40 truncate">{card.set.name}</p>
                  {isSelected && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] font-bold text-navy uppercase tracking-wide">✓ 選択済み</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 選択済みカードの設定 ── */}
      {selected.size > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
            選択済み ({selected.size}件) — 条件・価格設定
          </h2>
          <div className="space-y-3">
            {[...selected.values()].map((card) => (
              <div key={card.id} className="rounded-lg border border-navy/10 bg-white p-4">
                <div className="flex items-start gap-3">
                  {card.images?.small && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.images.small} alt={card.name} className="h-16 w-auto rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-navy text-sm">{card.name}</p>
                    <p className="text-xs text-navy/50">{card.rarity ?? "—"} · {card.set.name} · #{card.number}</p>

                    <div className="mt-3 flex flex-wrap gap-4">
                      {/* コンディション */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-navy/40 block mb-1">コンディション</label>
                        <div className="flex gap-1">
                          {ALL_CONDITIONS.map((cond) => (
                            <button
                              key={cond}
                              onClick={() => toggleCondition(card.id, cond)}
                              className={[
                                "px-2 py-0.5 rounded text-[10px] font-semibold border transition",
                                card.conditions.includes(cond)
                                  ? "bg-navy text-white border-navy"
                                  : "bg-white text-navy/40 border-navy/20 hover:border-navy/40",
                              ].join(" ")}
                            >
                              {cond}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 価格レンジ */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-navy/40 block mb-1">価格レンジ (¥)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={card.minPrice}
                            onChange={(e) => updateSelected(card.id, { minPrice: Number(e.target.value) })}
                            className="w-24 rounded border border-navy/20 px-2 py-1 text-xs text-right"
                          />
                          <span className="text-xs text-navy/40">〜</span>
                          <input
                            type="number"
                            value={card.maxPrice}
                            onChange={(e) => updateSelected(card.id, { maxPrice: Number(e.target.value) })}
                            className="w-28 rounded border border-navy/20 px-2 py-1 text-xs text-right"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelected((prev) => { const n = new Map(prev); n.delete(card.id); return n; });
                    }}
                    className="text-navy/30 hover:text-navy/60 text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 保存ボタン */}
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-white hover:bg-navy/80 disabled:opacity-50"
            >
              {saving ? "追加中…" : `${selected.size}件を追加`}
            </button>
            {status && (
              <p className={`text-sm ${status.ok ? "text-green-700" : "text-red-600"}`}>
                {status.msg}
              </p>
            )}
          </div>
        </section>
      )}

      {/* 何もない状態 */}
      {!loading && results.length === 0 && !query && (
        <div className="rounded-lg border border-navy/10 bg-navy/[0.02] p-8 text-center text-sm text-navy/40">
          カード名を入力して検索してください。
        </div>
      )}
    </div>
  );
}
