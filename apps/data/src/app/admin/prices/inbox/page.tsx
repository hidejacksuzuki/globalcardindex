"use client";

/**
 * /admin/prices/inbox
 * RawMarketListing の承認・除外 inbox
 */

import { useState, useEffect, useCallback } from "react";

type CardInfo = { name: string; rarity: string; setName: string };

type Listing = {
  id:         string;
  cardId:     string;
  source:     string;
  title:      string;
  price:      number;
  url:        string | null;
  bidCount:   number | null;
  endedAt:    string | null;
  matchScore: number;
  trustScore: number;
  status:     string;
  capturedAt: string;
  card:       CardInfo;
};

const SOURCE_LABELS: Record<string, string> = {
  mercari_sold:          "Mercari 売切",
  mercari_listing:       "Mercari 販売中",
  yahoo_auction_closed:  "ヤフオク 落札",
  yahoo_auction_active:  "ヤフオク 開催中",
};

const SOURCE_COLORS: Record<string, string> = {
  mercari_sold:          "bg-red-100 text-red-700",
  mercari_listing:       "bg-orange-100 text-orange-700",
  yahoo_auction_closed:  "bg-purple-100 text-purple-700",
  yahoo_auction_active:  "bg-blue-100 text-blue-700",
};

type Filter = "pending" | "auto_approved" | "all";

export default function PricesInboxPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null);
  const [filter,   setFilter]   = useState<Filter>("pending");
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/v1/market-listings/pending?status=${filter}&limit=200`);
    const json = await res.json() as { ok: boolean; listings?: Listing[] };
    if (json.ok) setListings(json.listings ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function bulkAction(action: "approve" | "reject") {
    const ids = [...selected];
    if (!ids.length) return;
    const body = action === "approve" ? { ids } : { reject: ids };
    const res  = await fetch("/api/v1/market-listings/approve", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json() as { ok: boolean; approved?: number; rejected?: number };
    if (json.ok) {
      setMsg({
        text: action === "approve"
          ? `✓ ${json.approved}件 承認しました`
          : `✓ ${json.rejected}件 除外しました`,
        ok: true,
      });
      setSelected(new Set());
      void load();
    }
  }

  async function singleAction(id: string, action: "approve" | "reject") {
    const body = action === "approve" ? { ids: [id] } : { reject: [id] };
    await fetch("/api/v1/market-listings/approve", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    void load();
  }

  function scoreColor(n: number) {
    if (n >= 80) return "text-green-600 font-semibold";
    if (n >= 60) return "text-amber-600";
    return "text-red-500";
  }

  function statusBadge(s: string) {
    if (s === "auto_approved" || s === "approved")
      return "bg-green-100 text-green-700";
    if (s === "rejected")
      return "bg-red-100 text-red-600";
    if (s === "held")
      return "bg-gray-100 text-gray-600";
    return "bg-amber-100 text-amber-700";
  }

  const filtered = search
    ? listings.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.card.name.toLowerCase().includes(search.toLowerCase()),
      )
    : listings;

  return (
    <div className="space-y-6">
      <header className="border-b border-navy/10 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Prices</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Inbox</h1>
          <p className="mt-1 text-sm text-navy/50">
            RawMarketListing の承認・除外 ({filtered.length}件)
          </p>
        </div>
        <div className="flex gap-1 mt-1 shrink-0">
          {(["pending", "auto_approved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded px-3 py-1.5 text-xs transition",
                filter === f
                  ? "bg-navy text-white"
                  : "border border-navy/20 text-navy/60 hover:text-navy",
              ].join(" ")}
            >
              {f === "pending" ? "保留中" : f === "auto_approved" ? "自動承認" : "すべて"}
            </button>
          ))}
        </div>
      </header>

      {/* 検索 + 一括操作 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトル・カード名で絞り込み..."
          className="rounded border border-navy/20 px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-navy/30"
        />
        {selected.size > 0 && (
          <>
            <span className="text-xs text-navy/60">{selected.size}件選択中</span>
            <button
              onClick={() => void bulkAction("approve")}
              className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
            >
              一括承認
            </button>
            <button
              onClick={() => void bulkAction("reject")}
              className="rounded bg-red-500 px-3 py-1.5 text-xs text-white hover:bg-red-600"
            >
              一括除外
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-navy/40 hover:text-navy"
            >
              解除
            </button>
          </>
        )}
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-navy/40">読み込み中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-navy/40 border border-navy/10 bg-white p-6">
          該当するデータがありません。
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(filtered.map((l) => l.id)) : new Set())
                    }
                  />
                </th>
                <th className="px-4 py-3">カード</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">タイトル</th>
                <th className="px-4 py-3 text-right">価格</th>
                <th className="px-4 py-3 text-right">Match</th>
                <th className="px-4 py-3 text-right">Trust</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">日時</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className={[
                    "hover:bg-navy/[0.02]",
                    selected.has(l.id) ? "bg-navy/5" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() =>
                        setSelected((p) => {
                          const n = new Set(p);
                          n.has(l.id) ? n.delete(l.id) : n.add(l.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="font-medium text-navy">{l.card.name}</span>
                    <span className="ml-1 text-navy/40">{l.card.rarity}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[l.source] ?? "bg-navy/10 text-navy/60"}`}>
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate text-xs text-navy/70">
                    {l.url ? (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {l.title}
                      </a>
                    ) : (
                      l.title
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-navy">
                    ¥{l.price.toLocaleString()}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums text-xs ${scoreColor(l.matchScore)}`}>
                    {l.matchScore}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums text-xs ${scoreColor(l.trustScore)}`}>
                    {l.trustScore}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(l.status)}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[11px] text-navy/40 tabular-nums whitespace-nowrap">
                    {new Date(l.capturedAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => void singleAction(l.id, "approve")}
                        className="rounded bg-green-600 px-2 py-0.5 text-[10px] text-white hover:bg-green-700"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => void singleAction(l.id, "reject")}
                        className="rounded bg-red-500 px-2 py-0.5 text-[10px] text-white hover:bg-red-600"
                      >
                        除外
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
