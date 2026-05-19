"use client";

/**
 * /admin/cards/[id]/collect
 *
 * Semi-automated price collection page.
 * 1. Shows Mercari search buttons for the card
 * 2. User pastes JSON from search results (or Chrome extension sends it)
 * 3. Listings are scored and shown in a review table
 * 4. User approves / rejects, then saves PriceSnapshot
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
  imageUrl?:  string;
  matchScore: number;
  trustScore: number;
  verdict:    "approved" | "review" | "rejected";
};

type SavedListing = {
  id:         string;
  title:      string;
  price:      number;
  matchScore: number;
  trustScore: number;
  status:     string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictColor(v: string) {
  if (v === "approved") return "bg-green-100 text-green-700";
  if (v === "review")   return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function verdictLabel(v: string) {
  if (v === "approved") return "自動承認";
  if (v === "review")   return "要確認";
  return "除外";
}

function mercariUrl(name: string, rarity: string, setName: string, sort: "score" | "price", order?: "asc" | "dsc") {
  const keyword = encodeURIComponent(`${name} ${rarity} ${setName}`.trim());
  const exclude = encodeURIComponent("オリパ 引退品 まとめ 海外 英語 proxy プレイ用 傷あり");
  let url = `https://jp.mercari.com/search?keyword=${keyword}&exclude_keyword=${exclude}&status=on_sale&sort=${sort}`;
  if (sort === "price" && order) url += `&order=${order}`;
  return url;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectPage() {
  const { id }                          = useParams<{ id: string }>();
  const [card, setCard]                 = useState<CardInfo | null>(null);
  const [pasteText, setPasteText]       = useState("");
  const [scored, setScored]             = useState<ScoredItem[]>([]);
  const [pending, setPending]           = useState<SavedListing[]>([]);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [loading, setLoading]           = useState(false);
  const [status, setStatus]             = useState("");

  // Load card info
  useEffect(() => {
    fetch(`/api/v1/cards/${id}`)
      .then((r) => r.json())
      .then((d) => setCard(d.card ?? d));
  }, [id]);

  // Load existing pending listings
  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/listings/pending?cardId=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPending(d.listings); });
  }, [id]);

  // ── Parse paste ──────────────────────────────────────────────────────────────

  function parsePaste(text: string): Array<{ title: string; price: number; url?: string }> {
    // Try JSON array first
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {}

    // Fallback: line-by-line "title\tprice" or "title ¥price"
    return text.split("\n").flatMap((line) => {
      const m = line.match(/^(.+?)\s+[¥￥]?([\d,]+)\s*$/);
      if (!m) return [];
      return [{ title: m[1].trim(), price: parseInt(m[2].replace(/,/g, ""), 10) }];
    });
  }

  async function handleImport() {
    const items = parsePaste(pasteText);
    if (items.length === 0) { setStatus("解析できるデータがありませんでした"); return; }
    setLoading(true);
    setStatus("");
    try {
      const res  = await fetch("/api/v1/import/mercari", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cardId: id, source: "mercari", items }),
      });
      const data = await res.json();
      if (data.ok) {
        setScored(data.items);
        setStatus(`${data.saved} 件を取り込みました`);
        setPasteText("");
        // Reload pending
        fetch(`/api/v1/listings/pending?cardId=${id}`)
          .then((r) => r.json())
          .then((d) => { if (d.ok) setPending(d.listings); });
      } else {
        setStatus(`エラー: ${data.error}`);
      }
    } catch (e) {
      setStatus("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    const approveIds = [...selected].filter(
      (sid) => pending.find((l) => l.id === sid)?.status === "pending"
    );
    if (approveIds.length === 0) { setStatus("承認するものを選択してください"); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/v1/listings/approve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: approveIds }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus(`${data.approved} 件を承認、PriceSnapshot 作成完了`);
        setSelected(new Set());
        fetch(`/api/v1/listings/pending?cardId=${id}`)
          .then((r) => r.json())
          .then((d) => { if (d.ok) setPending(d.listings); });
      } else {
        setStatus(`エラー: ${data.error}`);
      }
    } catch {
      setStatus("通信エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    const rejectIds = [...selected];
    if (rejectIds.length === 0) { setStatus("除外するものを選択してください"); return; }
    setLoading(true);
    try {
      await fetch("/api/v1/listings/approve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reject: rejectIds }),
      });
      setStatus(`${rejectIds.length} 件を除外しました`);
      setSelected(new Set());
      fetch(`/api/v1/listings/pending?cardId=${id}`)
        .then((r) => r.json())
        .then((d) => { if (d.ok) setPending(d.listings); });
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(lid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(lid) ? next.delete(lid) : next.add(lid);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(pending.map((l) => l.id)));
  }

  if (!card) return <div className="p-8 text-navy/50">読み込み中...</div>;

  const keyword = `${card.name} ${card.rarity} ${card.setName}`.trim();

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Cards › Collect</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">{card.name}</h1>
        <p className="mt-0.5 text-sm text-navy/50">{card.setName} / {card.rarity}</p>
      </header>

      {/* Mercari search buttons */}
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-navy/40">メルカリ検索</p>
        <p className="text-xs text-navy/50 font-mono break-all">{keyword}</p>
        <div className="flex flex-wrap gap-2">
          <SearchBtn href={mercariUrl(card.name, card.rarity, card.setName, "score")}          label="おすすめ順" color="bg-red-500 hover:bg-red-600" />
          <SearchBtn href={mercariUrl(card.name, card.rarity, card.setName, "price", "asc")}   label="安い順"    color="bg-blue-500 hover:bg-blue-600" />
          <SearchBtn href={mercariUrl(card.name, card.rarity, card.setName, "price", "dsc")}   label="高い順"    color="bg-amber-500 hover:bg-amber-600" />
        </div>
      </section>

      {/* Paste area */}
      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-navy/40">取り込み</p>
        <p className="text-xs text-navy/50">
          JSON 配列 <code>[{"{"}"title","price","url"{"}"}]</code> またはタブ区切りテキストを貼り付け
        </p>
        <textarea
          className="w-full h-32 rounded-lg border border-navy/20 bg-white px-3 py-2 font-mono text-xs text-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          placeholder={'[{"title":"ナンジャモ SAR sv2D","price":12800,"url":"https://jp.mercari.com/item/xxx"}]'}
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

      {/* Import preview (just scored) */}
      {scored.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-navy/40">取り込み結果</p>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full text-sm divide-y divide-navy/5">
              <thead className="bg-navy/5 text-xs uppercase tracking-widest text-navy/50 text-left">
                <tr>
                  <th className="px-4 py-2">タイトル</th>
                  <th className="px-4 py-2 text-right">価格</th>
                  <th className="px-4 py-2 text-right">Match</th>
                  <th className="px-4 py-2 text-right">Trust</th>
                  <th className="px-4 py-2">判定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {scored.map((item, i) => (
                  <tr key={i} className="hover:bg-navy/[0.02]">
                    <td className="max-w-xs truncate px-4 py-2 text-navy/80">
                      {item.url
                        ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">{item.title}</a>
                        : item.title}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">¥{item.price.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{item.matchScore}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{item.trustScore}</td>
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

      {/* Pending listings review */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-navy/40">
              承認待ち ({pending.length} 件)
            </p>
            <button onClick={selectAll} className="text-xs text-navy/50 underline">すべて選択</button>
          </div>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full text-sm divide-y divide-navy/5">
              <thead className="bg-navy/5 text-xs uppercase tracking-widest text-navy/50 text-left">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-4 py-2">タイトル</th>
                  <th className="px-4 py-2 text-right">価格</th>
                  <th className="px-4 py-2 text-right">Match</th>
                  <th className="px-4 py-2">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {pending.map((l) => (
                  <tr key={l.id} className={`hover:bg-navy/[0.02] ${selected.has(l.id) ? "bg-navy/5" : ""}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleSelect(l.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-navy/80">{l.title}</td>
                    <td className="px-4 py-2 text-right tabular-nums">¥{l.price.toLocaleString()}</td>
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
            <button
              onClick={handleApprove}
              disabled={loading || selected.size === 0}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 transition"
            >
              承認して PriceSnapshot 作成 ({selected.size})
            </button>
            <button
              onClick={handleReject}
              disabled={loading || selected.size === 0}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-40 transition"
            >
              除外 ({selected.size})
            </button>
          </div>
        </section>
      )}

      {status && (
        <p className="text-sm text-navy/70 border-l-2 border-navy/20 pl-3">{status}</p>
      )}
    </div>
  );
}

function SearchBtn({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition ${color}`}
    >
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
