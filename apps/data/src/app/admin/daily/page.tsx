"use client";

/**
 * /admin/daily
 *
 * Daily operation dashboard — the operator's home base.
 *
 * Shows the full daily pipeline status at a glance:
 *   1. Watchlist  — how many cards to collect
 *   2. Collect    — open Mercari search URLs
 *   3. Review     — pending items awaiting approval
 *   4. Recalc     — last run status + trigger button
 *
 * Auto-refreshes every 60 s. Manual refresh via button.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type DailyStatus = {
  date:           string;
  sessions: {
    total:        number;
    items:        number;
    pending:      number;
    approved:     number;
    filtered:     number;
    error:        number;
  };
  recalc: {
    lastRunAt:      string | null;
    lastValue:      number | null;
    lastChangeRate: number | null;
    status:         "success" | "error" | "no_data" | "never";
  };
  watchlistCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function recalcStatusColor(status: DailyStatus["recalc"]["status"]): string {
  if (status === "success")  return "text-green-700 bg-green-50 border-green-200";
  if (status === "error")    return "text-red-700 bg-red-50 border-red-200";
  if (status === "no_data")  return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-navy/40 bg-navy/5 border-navy/10";
}

function pipelineStep(
  n: number,
  label: string,
  count: number | null,
  status: "done" | "active" | "pending" | "warn",
  href?: string,
  note?: string,
): React.ReactNode {
  const dotColor =
    status === "done"    ? "bg-green-500" :
    status === "active"  ? "bg-gold-500 animate-pulse" :
    status === "warn"    ? "bg-amber-500" :
    "bg-navy/20";

  const countColor =
    status === "warn"    ? "text-amber-700" :
    status === "done"    ? "text-green-700" :
    status === "active"  ? "text-navy" :
    "text-navy/40";

  return (
    <div key={n} className="flex items-start gap-4">
      {/* Step indicator */}
      <div className="flex flex-col items-center">
        <div className={`h-7 w-7 rounded-full border-2 border-white ring-2 ring-navy/10 flex items-center justify-center text-xs font-bold text-white ${dotColor}`}>
          {status === "done" ? "✓" : n}
        </div>
        {n < 4 && <div className="mt-1 h-8 w-px bg-navy/10" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-navy">{label}</p>
          {count !== null && (
            <span className={`text-lg font-semibold tabular-nums ${countColor}`}>
              {count}
            </span>
          )}
        </div>
        {note && <p className="mt-0.5 text-xs text-navy/50">{note}</p>}
        {href && (
          <Link
            href={href}
            className="mt-2 inline-block text-xs text-navy/60 underline hover:text-navy"
          >
            {href.replace("/admin/", "")} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDailyPage() {
  const [status,      setStatus]     = useState<DailyStatus | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [recalcBusy,  setRecalcBusy] = useState(false);
  const [recalcMsg,   setRecalcMsg]  = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/v1/collector/daily-status");
      const json = await res.json() as { ok: boolean; data: DailyStatus };
      if (json.ok) {
        setStatus(json.data);
        setLastFetched(new Date());
      }
    } catch {
      // silent — show stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 60-second auto-refresh
  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const triggerRecalc = async () => {
    setRecalcBusy(true);
    setRecalcMsg(null);
    try {
      const res  = await fetch("/api/v1/index/recalc", { method: "POST" });
      const json = await res.json() as { ok: boolean; data?: { saved: boolean; value?: number } };
      if (json.ok && json.data?.saved) {
        setRecalcMsg(`✓ 完了 — Index: ${json.data.value?.toFixed(2) ?? "—"}`);
      } else {
        setRecalcMsg("⚠ 完了（データなし）");
      }
      await fetchStatus();
    } catch (err) {
      setRecalcMsg(`✗ エラー: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setRecalcBusy(false);
    }
  };

  const s = status;

  // Derive pipeline step statuses
  const collectDone  = !!s && s.sessions.items > 0;
  const reviewDone   = !!s && s.sessions.pending === 0 && s.sessions.approved > 0;
  const reviewActive = !!s && s.sessions.pending > 0;
  const recalcDone   = !!s && s.recalc.status === "success" &&
    !!s.recalc.lastRunAt &&
    new Date(s.recalc.lastRunAt) > new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="space-y-8">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between border-b border-navy/10 pb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Daily Operations</h1>
          <p className="mt-1 text-sm text-navy/50">
            {s?.date ?? new Date().toISOString().slice(0, 10)}
            {lastFetched && (
              <span className="ml-3 text-navy/30">
                更新: {lastFetched.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => void fetchStatus()}
          className="rounded border border-navy/10 px-3 py-1.5 text-xs text-navy/50 transition hover:text-navy"
        >
          ↺ 更新
        </button>
      </header>

      {loading && (
        <p className="text-sm text-navy/40">読み込み中…</p>
      )}

      {!loading && s && (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">

          {/* ── Pipeline ─────────────────────────────────────────────────── */}
          <section className="space-y-0">
            <p className="mb-4 text-xs uppercase tracking-widest text-navy/40">
              今日のパイプライン
            </p>

            {/* Step 1: Watchlist */}
            {pipelineStep(
              1,
              "ウォッチリスト確認",
              s.watchlistCount,
              "done",
              "/admin/collector",
              `${s.watchlistCount} 件の検索URLが生成可能`,
            )}

            {/* Step 2: Collect */}
            {pipelineStep(
              2,
              "Mercari 収集",
              s.sessions.items,
              collectDone ? "done" : "active",
              "/admin/collector/import",
              collectDone
                ? `${s.sessions.total} セッション · ${s.sessions.items} 件収集済み`
                : "import ページでリストを貼り付けてください",
            )}

            {/* Step 3: Review */}
            {pipelineStep(
              3,
              "レビュー・承認",
              s.sessions.pending,
              reviewDone   ? "done"    :
              reviewActive ? "warn"    :
              "pending",
              "/admin/collector/review",
              reviewDone
                ? `${s.sessions.approved} 件承認済み · 保留なし`
                : reviewActive
                  ? `${s.sessions.pending} 件が承認待ち`
                  : "収集後にここで承認してください",
            )}

            {/* Step 4: Recalc */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={[
                  "h-7 w-7 rounded-full border-2 border-white ring-2 ring-navy/10",
                  "flex items-center justify-center text-xs font-bold text-white",
                  recalcDone ? "bg-green-500" : "bg-navy/20",
                ].join(" ")}>
                  {recalcDone ? "✓" : "4"}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-navy">Index 再計算</p>
                  {s.recalc.lastValue !== null && (
                    <span className="text-lg font-semibold tabular-nums text-navy">
                      {s.recalc.lastValue.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-navy/50">
                  {recalcDone
                    ? `最終実行: ${fmtTime(s.recalc.lastRunAt)} · 変動: ${
                        s.recalc.lastChangeRate !== null
                          ? `${s.recalc.lastChangeRate > 0 ? "+" : ""}${s.recalc.lastChangeRate.toFixed(2)}%`
                          : "—"
                      }`
                    : `前回: ${fmtTime(s.recalc.lastRunAt)}`
                  }
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => void triggerRecalc()}
                    disabled={recalcBusy}
                    className="rounded border border-navy bg-navy px-4 py-1.5 text-xs font-medium text-white transition hover:bg-navy-950 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recalcBusy ? "実行中…" : "今すぐ再計算"}
                  </button>
                  {recalcMsg && (
                    <span className="text-xs text-navy/60">{recalcMsg}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Stats sidebar ────────────────────────────────────────────── */}
          <aside className="space-y-4">

            {/* Today's collection */}
            <div className="rounded border border-navy/10 bg-white p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-navy/40">今日の収集</p>
              <dl className="grid grid-cols-2 gap-3">
                <StatCell label="セッション" value={s.sessions.total} />
                <StatCell label="合計"      value={s.sessions.items} />
                <StatCell label="承認済み"   value={s.sessions.approved} color="green" />
                <StatCell label="保留中"    value={s.sessions.pending}  color={s.sessions.pending > 0 ? "amber" : undefined} />
                <StatCell label="除外"      value={s.sessions.filtered} />
                <StatCell label="エラー"    value={s.sessions.error}   color={s.sessions.error > 0 ? "red" : undefined} />
              </dl>
            </div>

            {/* Recalc status */}
            <div className={`rounded border p-4 space-y-2 ${recalcStatusColor(s.recalc.status)}`}>
              <p className="text-xs uppercase tracking-widest opacity-60">Index 状態</p>
              <p className="text-sm font-medium capitalize">{s.recalc.status}</p>
              {s.recalc.lastRunAt && (
                <p className="text-xs opacity-60">
                  {new Date(s.recalc.lastRunAt).toLocaleString("ja-JP", {
                    month: "numeric", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            {/* Quick links */}
            <div className="rounded border border-navy/10 bg-white p-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-navy/40">クイックリンク</p>
              {[
                { href: "/admin/collector",        label: "🔗 Search URLs"  },
                { href: "/admin/collector/import", label: "📋 Import"       },
                { href: "/admin/collector/review", label: "✅ Review"       },
                { href: "/admin/collector/runs",   label: "📜 Run Log"      },
                { href: "/admin/index",            label: "📊 Index Quality" },
                { href: "/admin/logs",             label: "🔧 Cron Logs"    },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-xs text-navy/60 hover:text-navy transition"
                >
                  {label}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "amber" | "red";
}) {
  const valueClass =
    color === "green" ? "text-green-700" :
    color === "amber" ? "text-amber-700" :
    color === "red"   ? "text-red-700"   :
    "text-navy";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
