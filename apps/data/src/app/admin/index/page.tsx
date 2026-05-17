/**
 * /admin/index
 *
 * Week 18: Index quality dashboard.
 * - Per-card index quality table (latest IndexValue per card)
 * - Global GCI index history
 * - Manual recalc trigger button
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ConfidenceTier = "HIGH" | "MED" | "LOW";

type CardIndexRow = {
  cardId:       string;
  name:         string;
  setName:      string;
  rarity:       string;
  condition:    string;
  value:        number | null;
  changeRate:   number | null;
  sampleCount:  number | null;
  outlierCount: number | null;
  confidence:   ConfidenceTier | null;
  calculatedAt: string | null;
  averagePrice: number | null;
};

type GlobalIndexRow = {
  id:           string;
  value:        number;
  changeRate:   number;
  sampleCount:  number | null;
  outlierCount: number | null;
  confidence:   string | null;
  calculatedAt: string;
};

type IndexPageData = {
  cards:  CardIndexRow[];
  global: GlobalIndexRow[];
};

// ── Client Component ──────────────────────────────────────────────────────────

export default function AdminIndexPage() {
  const [data,          setData]          = useState<IndexPageData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcMsg,     setRecalcMsg]     = useState<string | null>(null);
  const [filter,        setFilter]        = useState<"all" | ConfidenceTier>("all");
  const [tab,           setTab]           = useState<"cards" | "global">("cards");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/index/quality");
      const json = await res.json();
      if (json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRecalc = async (cardId?: string) => {
    setRecalcLoading(true);
    setRecalcMsg(null);
    try {
      const res  = await fetch("/api/v1/index/recalc", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(cardId ? { cardId } : {}),
      });
      const json = await res.json();
      if (json.ok) {
        setRecalcMsg(cardId ? "✓ Card recalculated" : "✓ Full recalc complete");
        await loadData();
      } else {
        setRecalcMsg(`Error: ${json.error}`);
      }
    } finally {
      setRecalcLoading(false);
    }
  };

  const displayedCards =
    data?.cards.filter((c) =>
      filter === "all" ? true : c.confidence === filter,
    ) ?? [];

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-navy">Index Quality</h1>
            <p className="mt-1 text-sm text-navy/50">
              カード別インデックス品質と再計算ログ。
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={() => handleRecalc()}
              disabled={recalcLoading}
              className="rounded-md bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy/80 disabled:opacity-50"
            >
              {recalcLoading ? "Recalculating…" : "Full Recalc"}
            </button>
            {recalcMsg && (
              <p className={`text-[11px] ${recalcMsg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
                {recalcMsg}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Summary stats ──────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Cards with index" value={data.cards.filter((c) => c.value !== null).length} />
          <MiniStat label="High confidence"  value={data.cards.filter((c) => c.confidence === "HIGH").length} color="text-green-700"  />
          <MiniStat label="Med confidence"   value={data.cards.filter((c) => c.confidence === "MED").length}  color="text-amber-700"  />
          <MiniStat label="Low / no data"    value={data.cards.filter((c) => c.confidence === "LOW" || c.value === null).length} color="text-red-600" />
        </div>
      )}

      {/* ── Tab nav ────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-navy/10">
        {(["cards", "global"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
              tab === t
                ? "border-navy text-navy font-medium"
                : "border-transparent text-navy/40 hover:text-navy/60",
            ].join(" ")}
          >
            {t === "cards" ? "Per-Card Quality" : "Global History"}
          </button>
        ))}
      </div>

      {/* ── Loading ────────────────────────────────────────────── */}
      {loading && (
        <div className="py-12 text-center text-sm text-navy/40">Loading…</div>
      )}

      {/* ── Per-card tab ───────────────────────────────────────── */}
      {!loading && tab === "cards" && data && (
        <section className="space-y-4">

          {/* Confidence filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-navy/40">Filter:</span>
            {(["all", "HIGH", "MED", "LOW"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-medium transition",
                  filter === f
                    ? "bg-navy text-white"
                    : "bg-navy/5 text-navy/50 hover:bg-navy/10",
                ].join(" ")}
              >
                {f}
              </button>
            ))}
          </div>

          {displayedCards.length === 0 ? (
            <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/40">
              該当するカードがありません。
            </p>
          ) : (
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Set</th>
                    <th className="px-4 py-3">Cond</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3 text-right">Index</th>
                    <th className="px-4 py-3 text-right">Avg ¥</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                    <th className="px-4 py-3 text-right">Samples</th>
                    <th className="px-4 py-3 text-right">Outliers</th>
                    <th className="px-4 py-3">Calculated</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {displayedCards.map((card) => (
                    <tr key={card.cardId} className="hover:bg-navy/[0.02]">
                      <td className="max-w-[160px] truncate px-4 py-3 font-medium text-navy">
                        {card.name}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-xs text-navy/50">
                        {card.setName}
                      </td>
                      <td className="px-4 py-3">
                        <CondBadge condition={card.condition} />
                      </td>
                      <td className="px-4 py-3">
                        {card.confidence
                          ? <ConfidenceBadge tier={card.confidence} />
                          : <span className="text-xs text-navy/30">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
                        {card.value !== null
                          ? card.value.toFixed(1)
                          : <span className="text-navy/30">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                        {card.averagePrice !== null
                          ? `¥${Math.round(card.averagePrice).toLocaleString("ja-JP")}`
                          : "—"
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {card.changeRate !== null
                          ? <ChangeRate rate={card.changeRate} />
                          : <span className="text-navy/30">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                        {card.sampleCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                        {card.outlierCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-navy/40 tabular-nums">
                        {card.calculatedAt
                          ? new Date(card.calculatedAt).toLocaleDateString("ja-JP")
                          : "—"
                        }
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRecalc(card.cardId)}
                          disabled={recalcLoading}
                          className="rounded bg-navy/5 px-2 py-1 text-[10px] text-navy/50 transition hover:bg-navy/10 disabled:opacity-40"
                        >
                          Recalc
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Global history tab ─────────────────────────────────── */}
      {!loading && tab === "global" && data && (
        <section>
          {data.global.length === 0 ? (
            <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/40">
              まだ IndexValue がありません。
            </p>
          ) : (
            <div className="overflow-x-auto border border-navy/10 bg-white">
              <table className="min-w-full divide-y divide-navy/10 text-sm">
                <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                  <tr>
                    <th className="px-4 py-3">Calculated at</th>
                    <th className="px-4 py-3 text-right">GCI Value</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                    <th className="px-4 py-3 text-right">Samples</th>
                    <th className="px-4 py-3 text-right">Outliers</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/5">
                  {data.global.map((row, i) => (
                    <tr key={row.id} className="hover:bg-navy/[0.02]">
                      <td className="px-4 py-3 text-xs tabular-nums text-navy/70">
                        {new Date(row.calculatedAt).toLocaleString("ja-JP")}
                        {i === 0 && (
                          <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-700">
                            latest
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-navy">
                        {row.value.toLocaleString("ja-JP", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChangeRate rate={row.changeRate} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                        {row.sampleCount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                        {row.outlierCount ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.confidence
                          ? <ConfidenceBadge tier={row.confidence as ConfidenceTier} />
                          : <span className="text-xs text-navy/30">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-navy/30">
                        {row.id.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, color = "text-navy",
}: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4">
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ConfidenceBadge({ tier }: { tier: ConfidenceTier | string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-green-100 text-green-700",
    MED:  "bg-amber-100 text-amber-700",
    LOW:  "bg-red-100  text-red-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[tier] ?? "bg-navy/10 text-navy/50"}`}>
      {tier}
    </span>
  );
}

function CondBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    NM:  "bg-green-100 text-green-700",
    LP:  "bg-blue-100  text-blue-700",
    MP:  "bg-amber-100 text-amber-700",
    HP:  "bg-red-100   text-red-700",
    DMG: "bg-red-200   text-red-800",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[condition] ?? "bg-navy/10 text-navy/50"}`}>
      {condition}
    </span>
  );
}

function ChangeRate({ rate }: { rate: number }) {
  const color  = rate > 0 ? "text-gold-700" : rate < 0 ? "text-red-600" : "text-navy/40";
  const prefix = rate > 0 ? "▲" : rate < 0 ? "▼" : "";
  return (
    <span className={`tabular-nums ${color}`}>
      {prefix}{Math.abs(rate).toFixed(2)}%
    </span>
  );
}
