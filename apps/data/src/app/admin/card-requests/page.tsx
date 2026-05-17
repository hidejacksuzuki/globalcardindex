"use client";

/**
 * /admin/card-requests
 *
 * Review and action user-submitted card addition requests.
 *
 * Tabs:
 *   Pending | Added | Declined | All — individual request rows
 *   Grouped — requests aggregated by name (duplicate detection + demand signal)
 *
 * Actions: Mark as Added | Decline | Convert to Card
 */

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardRequest = {
  id:          string;
  name:        string;
  setName:     string | null;
  game:        string | null;
  rarity:      string | null;
  requestedBy: string | null;
  note:        string | null;
  status:      string;
  reviewNote:  string | null;
  reviewedAt:  string | null;
  createdAt:   string;
};

type GroupedRequest = {
  name:   string;
  game:   string | null;
  count:  number;
  sample: Pick<CardRequest, "id" | "name" | "setName" | "game" | "rarity" | "status" | "createdAt"> | null;
};

type Tab = "pending" | "added" | "declined" | "all" | "grouped";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending",  label: "Pending"  },
  { key: "grouped",  label: "Grouped ✦"},
  { key: "added",    label: "Added"    },
  { key: "declined", label: "Declined" },
  { key: "all",      label: "All"      },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CardRequestsPage() {
  const [tab,       setTab]       = useState<Tab>("pending");
  const [requests,  setRequests]  = useState<CardRequest[]>([]);
  const [groups,    setGroups]    = useState<GroupedRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState<string | null>(null);

  // Convert modal state
  const [converting,   setConverting]   = useState<CardRequest | null>(null);
  const [cvtSetName,   setCvtSetName]   = useState("");
  const [cvtRarity,    setCvtRarity]    = useState("");
  const [cvtCondition, setCvtCondition] = useState("NM");
  const [cvtGame,      setCvtGame]      = useState("");
  const [cvtBusy,      setCvtBusy]      = useState(false);
  const [cvtResult,    setCvtResult]    = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === "grouped") {
        const res  = await fetch("/api/v1/card-requests/grouped?status=pending&limit=200");
        const json = await res.json() as { ok: boolean; groups: GroupedRequest[] };
        if (json.ok) setGroups(json.groups);
      } else {
        const res  = await fetch(`/api/v1/card-requests?status=${t}&limit=200`);
        const json = await res.json() as { ok: boolean; requests: CardRequest[] };
        if (json.ok) setRequests(json.requests);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const action = async (id: string, status: "added" | "declined" | "pending", note?: string) => {
    setBusy(id);
    try {
      await fetch(`/api/v1/card-requests/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, reviewNote: note }),
      });
      await load(tab);
    } finally {
      setBusy(null);
    }
  };

  const openConvert = (r: CardRequest) => {
    setConverting(r);
    setCvtSetName(r.setName ?? "");
    setCvtRarity(r.rarity ?? "");
    setCvtCondition("NM");
    setCvtGame(r.game ?? "");
    setCvtResult(null);
  };

  const submitConvert = async () => {
    if (!converting) return;
    setCvtBusy(true);
    setCvtResult(null);
    try {
      const res  = await fetch(`/api/v1/card-requests/${converting.id}/convert`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          setName:   cvtSetName   || undefined,
          rarity:    cvtRarity    || undefined,
          condition: cvtCondition || undefined,
          game:      cvtGame      || undefined,
        }),
      });
      const json = await res.json() as { ok: boolean; cardId?: string; slug?: string; error?: string };
      if (json.ok) {
        setCvtResult({ ok: true, msg: `Card created! slug: ${json.slug ?? json.cardId}` });
        await load(tab);
      } else {
        setCvtResult({ ok: false, msg: json.error ?? "変換に失敗しました。" });
      }
    } catch {
      setCvtResult({ ok: false, msg: "ネットワークエラー" });
    } finally {
      setCvtBusy(false);
    }
  };

  return (
    <div className="space-y-6">

      <header className="border-b border-navy/10 pb-5">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Card Requests</h1>
        <p className="mt-1 text-sm text-navy/50">
          ユーザーから寄せられたカード追加リクエスト。Grouped タブで需要の高いカードを確認できます。
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy/10">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
              tab === key
                ? "border-navy text-navy font-medium"
                : "border-transparent text-navy/40 hover:text-navy/60",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-navy/40">読み込み中…</p>
      ) : tab === "grouped" ? (
        <GroupedView groups={groups} onConvert={openConvert} />
      ) : requests.length === 0 ? (
        <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/40">
          {tab === "pending" ? "リクエストはありません。" : "このタブにはデータがありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-[10px] uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-4 py-3 text-left">カード名</th>
                <th className="px-4 py-3 text-left">セット / ゲーム</th>
                <th className="px-4 py-3 text-left">リクエスト者</th>
                <th className="px-4 py-3 text-left">メモ</th>
                <th className="px-4 py-3 text-left">日時</th>
                <th className="px-4 py-3 text-left">ステータス</th>
                {tab === "pending" && <th className="px-4 py-3 text-right">アクション</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-navy/[0.02] text-navy/80">
                  <td className="px-4 py-3 font-medium text-navy">
                    {r.name}
                    {r.rarity && <span className="ml-2 text-xs text-navy/40">{r.rarity}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/50">
                    <div>{r.setName ?? "—"}</div>
                    {r.game && <div className="text-navy/30">{r.game}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/50">
                    {r.requestedBy ?? <span className="text-navy/25">匿名</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/60 max-w-[200px]">
                    <span className="line-clamp-2">{r.note ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/40 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  {tab === "pending" && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openConvert(r)}
                          disabled={busy === r.id}
                          className="rounded border border-blue-400 px-2.5 py-1 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
                        >
                          Card化
                        </button>
                        <button
                          onClick={() => void action(r.id, "added")}
                          disabled={busy === r.id}
                          className="rounded border border-green-600 px-2.5 py-1 text-[11px] font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-40"
                        >
                          追加済み
                        </button>
                        <button
                          onClick={() => void action(r.id, "declined")}
                          disabled={busy === r.id}
                          className="rounded border border-navy/20 px-2.5 py-1 text-[11px] font-medium text-navy/50 transition hover:bg-navy/5 disabled:opacity-40"
                        >
                          却下
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Convert Modal */}
      {converting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !cvtBusy) setConverting(null); }}
        >
          <div className="w-full max-w-md rounded-lg border border-navy/10 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-navy">Card に変換</h2>
                <p className="mt-0.5 text-xs text-navy/50">
                  「{converting.name}」を Card レコードとして追加します。
                </p>
              </div>
              <button
                onClick={() => setConverting(null)}
                disabled={cvtBusy}
                className="text-navy/30 hover:text-navy/60 transition text-lg leading-none"
              >×</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">セット名</label>
                  <input
                    value={cvtSetName}
                    onChange={(e) => setCvtSetName(e.target.value)}
                    placeholder="Unknown Set"
                    className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">レアリティ</label>
                  <input
                    value={cvtRarity}
                    onChange={(e) => setCvtRarity(e.target.value)}
                    placeholder="Unknown"
                    className="w-full rounded border border-navy/20 px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">Condition</label>
                  <select
                    value={cvtCondition}
                    onChange={(e) => setCvtCondition(e.target.value)}
                    className="w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy/60"
                  >
                    {["NM","LP","MP","HP","DMG"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-widest text-navy/50">ゲーム</label>
                  <select
                    value={cvtGame}
                    onChange={(e) => setCvtGame(e.target.value)}
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

              {cvtResult && (
                <p className={`rounded px-3 py-2 text-xs ${cvtResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  {cvtResult.msg}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setConverting(null)}
                  disabled={cvtBusy}
                  className="rounded border border-navy/20 px-4 py-2 text-xs text-navy/60 transition hover:bg-navy/5"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => void submitConvert()}
                  disabled={cvtBusy || cvtResult?.ok === true}
                  className="rounded border border-navy bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy/90 disabled:opacity-40"
                >
                  {cvtBusy ? "変換中…" : "Card 作成"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grouped View ──────────────────────────────────────────────────────────────

function GroupedView({
  groups,
  onConvert,
}: {
  groups: GroupedRequest[];
  onConvert: (r: CardRequest) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded border border-navy/10 bg-white p-6 text-sm text-navy/40">
        未処理のリクエストはありません。
      </p>
    );
  }

  const gameLabel: Record<string, string> = {
    pokemon:  "ポケカ",
    onepiece: "ワンピース",
    yugioh:   "遊戯王",
    mtg:      "MTG",
  };

  return (
    <div className="overflow-x-auto border border-navy/10 bg-white">
      <table className="min-w-full divide-y divide-navy/10 text-sm">
        <thead className="bg-navy/5 text-[10px] uppercase tracking-widest text-navy/50">
          <tr>
            <th className="px-4 py-3 text-left">カード名</th>
            <th className="px-4 py-3 text-left">ゲーム</th>
            <th className="px-4 py-3 text-left">セット（サンプル）</th>
            <th className="px-4 py-3 text-center">リクエスト数</th>
            <th className="px-4 py-3 text-right">アクション</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {groups.map((g, i) => (
            <tr key={`${g.name}-${g.game ?? ""}-${i}`} className="hover:bg-navy/[0.02] text-navy/80">
              <td className="px-4 py-3 font-medium text-navy">{g.name}</td>
              <td className="px-4 py-3 text-xs text-navy/50">
                {g.game ? (gameLabel[g.game] ?? g.game) : <span className="text-navy/25">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-navy/50">
                {g.sample?.setName ?? <span className="text-navy/25">—</span>}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={[
                  "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                  g.count >= 5 ? "bg-amber-100 text-amber-700" :
                  g.count >= 3 ? "bg-blue-100 text-blue-700" :
                  "bg-navy/10 text-navy/50",
                ].join(" ")}>
                  {g.count}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {g.sample && (
                  <button
                    onClick={() => {
                      onConvert({
                        id:          g.sample!.id,
                        name:        g.sample!.name,
                        setName:     g.sample!.setName ?? null,
                        game:        g.sample!.game ?? null,
                        rarity:      g.sample!.rarity ?? null,
                        requestedBy: null,
                        note:        null,
                        status:      g.sample!.status,
                        reviewNote:  null,
                        reviewedAt:  null,
                        createdAt:   g.sample!.createdAt,
                      });
                    }}
                    className="rounded border border-blue-400 px-3 py-1 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    Card化
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:  "bg-amber-100 text-amber-700",
    added:    "bg-green-100 text-green-700",
    declined: "bg-navy/10 text-navy/40",
  };
  const labels: Record<string, string> = {
    pending:  "未処理",
    added:    "追加済み",
    declined: "却下",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status] ?? "bg-navy/10 text-navy/50"}`}>
      {labels[status] ?? status}
    </span>
  );
}
