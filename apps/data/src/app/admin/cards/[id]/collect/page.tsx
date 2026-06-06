"use client";

/**
 * /admin/cards/[id]/collect
 *
 * Semi-automated price collection page.
 * Tabs: Mercari | ヤフオク開催中 | ヤフオク落札済み
 */

import { useEffect, useState } from "react";
import { useParams }           from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type CardInfo = {
  id:      string;
  name:    string;
  setName: string;
  rarity:  string;
  game:    string | null;
};

type ScoredItem = {
  title:      string;
  price:      number;
  url?:       string;
  bidCount?:  number;
  matchScore: number;
  trustScore: number;
  verdict:    "approved" | "review" | "rejected";
};

type PendingListing = {
  id:         string;
  title:      string;
  price:      number;
  bidCount?:  number | null;
  endedAt?:   string | null;
  matchScore: number;
  trustScore: number;
  status:     string;
};

type TabId = "mercari_sold" | "mercari_listing" | "yahoo_auction_closed" | "yahoo_auction_active";

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictColor(v: string) {
  if (v === "approved" || v === "approved") return "bg-green-100 text-green-700";
  if (v === "review"   || v === "pending")  return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function verdictLabel(v: string) {
  if (v === "approved") return "自動承認";
  if (v === "review" || v === "pending") return "要確認";
  return "除外";
}

function encKw(s: string) { return encodeURIComponent(s); }
const EXCL = encKw("オリパ 引退品 まとめ 海外 英語 proxy プレイ用 傷あり");

function mercariUrl(kw: string, sort: "score" | "price", order?: string, sold = false) {
  const status = sold ? "sold_out" : "on_sale";
  let u = `https://jp.mercari.com/search?keyword=${encKw(kw)}&exclude_keyword=${EXCL}&status=${status}&sort=${sort}`;
  if (sort === "price" && order) u += `&order=${order}`;
  return u;
}

function yahooUrl(kw: string, closed: boolean) {
  if (closed) {
    // 落札相場（終了分）: tab_ex=commerce で落札済みに絞る
    return `https://auctions.yahoo.co.jp/search/search?p=${encKw(kw)}&tab_ex=commerce&auccat=0&s1=end&o1=d&b=1&n=50&ei=utf-8`;
  }
  return `https://auctions.yahoo.co.jp/search/search?p=${encKw(kw)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectPage() {
  const { id }                    = useParams<{ id: string }>();
  const [card, setCard]           = useState<CardInfo | null>(null);
  const [tab, setTab]             = useState<TabId>("mercari_sold");
  const [pasteText, setPasteText] = useState("");
  const [scored, setScored]       = useState<ScoredItem[]>([]);
  const [pending, setPending]     = useState<PendingListing[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/cards/${id}`)
      .then((r) => r.json())
      .then((d) => setCard(d.card ?? d));
  }, [id]);

  const fetchPending = (tabId: TabId, inclRejected: boolean) => {
    if (!id) return;
    const statusParam = inclRejected ? "all" : "pending";
    const qs = [`source=${tabId}`, `cardId=${id}`, `status=${statusParam}`].join("&");
    fetch(`/api/v1/market-listings/pending?${qs}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; listings?: PendingListing[] }) => {
        if (d.ok) setPending(d.listings ?? []);
        setSelected(new Set());
      });
  };

  useEffect(() => {
    fetchPending(tab, showRejected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tab, showRejected]);

  function parsePaste(text: string): object[] {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return text.split("\n").flatMap((line) => {
      const m = line.match(/^(.+?)\s+[¥￥]?([\d,]+)\s*$/);
      if (!m) return [];
      return [{ title: m[1].trim(), price: parseInt(m[2].replace(/,/g, ""), 10) }];
    });
  }

  async function handleImport() {
    const items = parsePaste(pasteText);
    if (items.length === 0) { setMsg("解析できるデータがありませんでした"); return; }
    setLoading(true); setMsg("");
    try {
      const res  = await fetch("/api/v1/import/market-results", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cardId: id, source: tab, items }),
      });
      const data = await res.json() as { ok: boolean; saved?: number; autoApproved?: number; skipped?: number; items?: ScoredItem[]; error?: string };
      if (data.ok) {
        setScored(data.items ?? []);
        setMsg(`${data.saved}件取り込み（自動承認: ${data.autoApproved}件）`);
        setPasteText("");
        fetchPending(tab, showRejected);
      } else {
        setMsg(`エラー: ${data.error}`);
      }
    } catch { setMsg("通信エラー"); }
    finally { setLoading(false); }
  }

  async function handleApprove() {
    const ids = [...selected];
    if (ids.length === 0) { setMsg("承認するものを選択してください"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/market-listings/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json() as { ok: boolean; approved?: number; error?: string };
      if (data.ok) {
        setMsg(`${data.approved}件 承認しました`);
        setSelected(new Set());
        fetchPending(tab, showRejected);
      } else { setMsg(`エラー: ${data.error}`); }
    } catch { setMsg("通信エラー"); }
    finally { setLoading(false); }
  }

  async function handleReject() {
    const ids = [...selected];
    if (ids.length === 0) { setMsg("除外するものを選択してください"); return; }
    setLoading(true);
    try {
      await fetch("/api/v1/market-listings/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reject: ids }),
      });
      setMsg(`${ids.length}件 除外しました`);
      setSelected(new Set());
      fetchPending(tab, showRejected);
    } finally { setLoading(false); }
  }

  if (!card) return <div className="p-8 text-navy/50">読み込み中...</div>;

  const kw = `${card.name} ${card.rarity} ${card.setName}`.trim();

  const TABS: { id: TabId; label: string }[] = [
    { id: "mercari_sold",          label: "Mercari 売り切れ"  },
    { id: "mercari_listing",       label: "Mercari 販売中"    },
    { id: "yahoo_auction_closed",  label: "ヤフオク落札済み"  },
    { id: "yahoo_auction_active",  label: "ヤフオク開催中"    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Cards › Collect</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">{card.name}</h1>
        <p className="mt-0.5 text-sm text-navy/50">{card.setName} / {card.rarity}</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setScored([]); setMsg(""); }}
            className={[
              "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
              tab === t.id
                ? "border-navy text-navy font-medium"
                : "border-transparent text-navy/40 hover:text-navy/60",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search buttons */}
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-navy/40">検索URL</p>
        <p className="font-mono text-xs text-navy/50 break-all">{kw}</p>
        <div className="flex flex-wrap gap-2">
          {tab === "mercari_sold" && <>
            <SearchBtn href={mercariUrl(kw, "score", undefined, true)}      label="おすすめ順（売切）" color="bg-red-500 hover:bg-red-600" />
            <SearchBtn href={mercariUrl(kw, "price", "asc",    true)}       label="安い順"             color="bg-blue-500 hover:bg-blue-600" />
            <SearchBtn href={mercariUrl(kw, "price", "dsc",    true)}       label="高い順"             color="bg-amber-500 hover:bg-amber-600" />
          </>}
          {tab === "mercari_listing" && <>
            <SearchBtn href={mercariUrl(kw, "score")}         label="おすすめ順（販売中）" color="bg-orange-500 hover:bg-orange-600" />
          </>}
          {tab === "yahoo_auction_active" && <>
            <SearchBtn href={yahooUrl(kw, false)} label="ヤフオク開催中" color="bg-purple-500 hover:bg-purple-600" />
          </>}
          {tab === "yahoo_auction_closed" && <>
            <SearchBtn href={yahooUrl(kw, true)} label="落札相場を開く" color="bg-indigo-500 hover:bg-indigo-600" />
          </>}
        </div>
      </section>

      {/* Paste area */}
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-navy/40">取り込み</p>
        {(tab === "yahoo_auction_closed" || tab === "mercari_sold") && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            成約データ（{tab}）は指数に直接反映されます。自動スコアリングで高スコアのものは自動承認されます。
          </p>
        )}
        <p className="text-xs text-navy/50">
          JSON 配列 <code>[{"{"}"title","price","bidCount","endedAt"{"}"}]</code> またはタブ区切りを貼り付け
        </p>
        <textarea
          className="w-full h-32 rounded-lg border border-navy/20 bg-white px-3 py-2 font-mono text-xs text-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          placeholder={
            tab === "mercari_sold" || tab === "mercari_listing"
              ? '[{"title":"ナンジャモ SAR sv2D","price":12800,"url":"https://jp.mercari.com/item/m123"}]'
              : '[{"title":"ナンジャモ SAR sv2D","price":11500,"bidCount":12,"endedAt":"2026-05-10T10:00:00Z"}]'
          }
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button
          onClick={handleImport}
          disabled={loading || !pasteText.trim()}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/80 disabled:opacity-40 transition"
        >
          {loading ? "処理中..." : "取り込む"}
        </button>
      </section>

      {/* Import preview */}
      {scored.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-navy/40">取り込み結果</p>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full text-sm divide-y divide-navy/5">
              <thead className="bg-navy/5 text-xs uppercase tracking-widest text-navy/50 text-left">
                <tr>
                  <th className="px-4 py-2">タイトル</th>
                  <th className="px-4 py-2 text-right">価格</th>
                  {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && <th className="px-4 py-2 text-right">入札</th>}
                  <th className="px-4 py-2 text-right">Match</th>
                  <th className="px-4 py-2">判定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {scored.map((item, i) => (
                  <tr key={i} className="hover:bg-navy/[0.02]">
                    <td className="max-w-xs truncate px-4 py-2 text-navy/80">{item.title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">¥{item.price.toLocaleString()}</td>
                    {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && <td className="px-4 py-2 text-right tabular-nums">{item.bidCount ?? "-"}</td>}
                    <td className="px-4 py-2 text-right tabular-nums">{item.matchScore}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${verdictColor(item.verdict)}`}>
                        {verdictLabel(item.verdict)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending review */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-navy/40">
            {showRejected ? "全データ" : "承認待ち"} ({pending.length} 件)
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-navy/50 cursor-pointer">
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
                className="rounded"
              />
              除外済みも表示
            </label>
            <button onClick={() => setSelected(new Set(pending.map((l) => l.id)))} className="text-xs text-navy/50 underline">すべて選択</button>
          </div>
        </div>
        {pending.length > 0 && (<>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full text-sm divide-y divide-navy/5">
              <thead className="bg-navy/5 text-xs uppercase tracking-widest text-navy/50 text-left">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-4 py-2">タイトル</th>
                  <th className="px-4 py-2 text-right">価格</th>
                  {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && <th className="px-4 py-2 text-right">入札</th>}
                  {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && <th className="px-4 py-2">終了日</th>}
                  <th className="px-4 py-2 text-right">Match</th>
                  <th className="px-4 py-2">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {pending.map((l) => (
                  <tr key={l.id} className={`hover:bg-navy/[0.02] ${selected.has(l.id) ? "bg-navy/5" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(l.id)}
                        onChange={() => setSelected((p) => { const n = new Set(p); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })}
                        className="rounded" />
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-navy/80">{l.title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">¥{l.price.toLocaleString()}</td>
                    {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && <td className="px-4 py-2 text-right tabular-nums">{l.bidCount ?? "-"}</td>}
                    {tab === "yahoo_auction_closed" || tab === "yahoo_auction_active" && (
                      <td className="px-4 py-2 text-xs text-navy/50">
                        {l.endedAt ? new Date(l.endedAt).toLocaleDateString("ja-JP") : "-"}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right tabular-nums">{l.matchScore}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${verdictColor(l.status)}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApprove} disabled={loading || selected.size === 0}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 transition">
              承認 + PriceSnapshot ({selected.size})
            </button>
            <button onClick={handleReject} disabled={loading || selected.size === 0}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition">
              除外 ({selected.size})
            </button>
          </div>
        </>)}
      </section>

      {msg && <p className="text-sm text-navy/70 border-l-2 border-navy/20 pl-3">{msg}</p>}
    </div>
  );
}

function SearchBtn({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition ${color}`}>
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
