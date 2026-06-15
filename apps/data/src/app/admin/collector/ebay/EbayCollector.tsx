"use client";

import { useState } from "react";

type CardAlias = {
  id:          string;
  name:        string;
  cardNumber:  string | null;
  language:    string | null;
  market:      string;
  searchQuery: string | null;
  card: { id: string; name: string; setName: string; rarity: string; game: string | null };
};

type EbayListingRow = {
  id:           string;
  title:        string;
  price:        number;
  currency:     string;
  shippingPrice: number | null;
  totalPrice:   number;
  priceJpy:     number | null;
  soldAt:       string | null;
  listingUrl:   string | null;
  imageUrl:     string | null;
  sellerName:   string | null;
  sellerFeedbackScore: number | null;
  matchScore:   number;
  status:       string;
  rejectReason: string | null;
  conditionText: string | null;
};

type SearchResult = {
  ok:         boolean;
  query?:     string;
  listings?:  EbayListingRow[];
  totalFound?: number;
  error?:     string;
};

type Props = { aliases: CardAlias[] };

export function EbayCollector({ aliases }: Props) {
  const [aliasId, setAliasId]     = useState<string>(aliases[0]?.id ?? "");
  const [listingType, setListingType] = useState<"sold" | "active">("sold");
  const [limit, setLimit]         = useState(50);
  const [busy, setBusy]           = useState(false);
  const [result, setResult]       = useState<SearchResult | null>(null);
  const [listings, setListings]   = useState<EbayListingRow[]>([]);
  const [rejectText, setRejectText] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const selectedAlias = aliases.find((a) => a.id === aliasId);

  const handleSearch = async () => {
    if (!aliasId) return;
    setBusy(true); setResult(null); setListings([]); setActionMsg(null);
    try {
      const res  = await fetch("/api/admin/ebay/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cardAliasId: aliasId, listingType, limit }),
      });
      const json = await res.json() as SearchResult;
      setResult(json);
      if (json.ok && json.listings) {
        setListings(json.listings.sort((a, b) => b.matchScore - a.matchScore));
      }
    } finally { setBusy(false); }
  };

  const doAction = async (id: string, action: "approve" | "reject" | "import") => {
    setBusy(true); setActionMsg(null);
    try {
      const url  = `/api/admin/ebay/listings/${id}/${action}`;
      const body = action === "reject" ? { reason: rejectText[id] } : {};
      const res  = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json() as { ok: boolean; error?: string; duplicate?: boolean };
      if (json.ok) {
        const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "imported";
        setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l));
        setActionMsg(`✓ ${action}: ${id.slice(0, 8)}…${json.duplicate ? " (重複スキップ)" : ""}`);
      } else {
        setActionMsg(`✗ ${json.error ?? "エラー"}`);
      }
    } finally { setBusy(false); }
  };

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-700 bg-emerald-50" :
    s >= 60 ? "text-amber-700 bg-amber-50" :
              "text-red-700 bg-red-50";

  return (
    <div className="space-y-6">
      {/* 検索フォーム */}
      <div className="rounded-lg border border-navy/10 bg-white p-5 space-y-4">
        <p className="text-xs font-medium uppercase tracking-widest text-navy/40">eBay 検索設定</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-navy/40">CardAlias</p>
            <select
              value={aliasId}
              onChange={(e) => setAliasId(e.target.value)}
              className={inputCls}
            >
              {aliases.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.card.game ?? "?"}] {a.card.name} / {a.name}
                  {a.cardNumber ? ` (${a.cardNumber})` : ""}
                  {a.language ? ` — ${a.language}` : ""}
                </option>
              ))}
            </select>
            {selectedAlias?.searchQuery && (
              <p className="mt-1 font-mono text-[11px] text-navy/40">
                Query: {selectedAlias.searchQuery}
              </p>
            )}
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-navy/40">Listing Type</p>
            <select value={listingType} onChange={(e) => setListingType(e.target.value as "sold" | "active")}
              className={inputCls}>
              <option value="sold">Sold Listings</option>
              <option value="active">Active Listings</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-navy/40">件数上限</p>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className={`${inputCls} w-24`}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={busy || !aliasId}
            className="mt-4 rounded border border-navy bg-navy px-6 py-2 text-xs font-medium text-white hover:bg-navy/80 disabled:opacity-40"
          >
            {busy ? "検索中…" : "eBay 検索"}
          </button>
        </div>

        {result && !result.ok && (
          <p className="text-xs text-red-600">✗ {result.error}</p>
        )}
        {result?.ok && (
          <p className="text-xs text-navy/50">
            Query: <code className="font-mono">{result.query}</code>
            {" "}— {result.totalFound} 件取得
          </p>
        )}
      </div>

      {actionMsg && (
        <p className={`text-xs ${actionMsg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>
          {actionMsg}
        </p>
      )}

      {/* 結果一覧 */}
      {listings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-navy/40">
              検索結果 — matchScore 順
            </p>
            <p className="text-[11px] text-navy/40">
              pending: {listings.filter((l) => l.status === "pending").length} /
              approved: {listings.filter((l) => l.status === "approved").length} /
              rejected: {listings.filter((l) => l.status === "rejected").length} /
              imported: {listings.filter((l) => l.status === "imported").length}
            </p>
          </div>

          {listings.map((listing) => (
            <div
              key={listing.id}
              className={`rounded-lg border bg-white ${
                listing.status === "rejected"
                  ? "border-red-100 opacity-50"
                  : listing.status === "imported"
                  ? "border-emerald-100"
                  : "border-navy/10"
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                {/* matchScore バッジ */}
                <div className={`shrink-0 rounded px-2 py-1 text-center ${scoreColor(listing.matchScore)}`}>
                  <p className="text-lg font-bold tabular-nums">{listing.matchScore}</p>
                  <p className="text-[9px] uppercase tracking-wide">score</p>
                </div>

                {/* メイン情報 */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-navy truncate">{listing.title}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-navy/50">
                    <span className="font-medium text-navy">
                      {listing.currency} {listing.totalPrice.toFixed(2)}
                      {listing.priceJpy && (
                        <span className="ml-1 text-navy/50">
                          (¥{listing.priceJpy.toLocaleString()})
                        </span>
                      )}
                    </span>
                    {listing.shippingPrice != null && (
                      <span>送料 {listing.currency} {listing.shippingPrice.toFixed(2)}</span>
                    )}
                    {listing.soldAt && (
                      <span>成約: {new Date(listing.soldAt).toLocaleDateString("ja-JP")}</span>
                    )}
                    {listing.sellerName && (
                      <span>出品者: {listing.sellerName}
                        {listing.sellerFeedbackScore != null &&
                          ` (${listing.sellerFeedbackScore.toLocaleString()})`}
                      </span>
                    )}
                    {listing.conditionText && <span>状態: {listing.conditionText}</span>}
                  </div>
                  {listing.listingUrl && (
                    <a href={listing.listingUrl} target="_blank" rel="noreferrer"
                      className="text-[11px] text-navy/40 underline underline-offset-2 hover:text-navy">
                      eBay で開く →
                    </a>
                  )}
                </div>

                {/* ステータスバッジ */}
                <div className="shrink-0">
                  <StatusBadge status={listing.status} />
                </div>
              </div>

              {/* アクションバー */}
              {listing.status === "pending" && (
                <div className="flex items-center gap-3 border-t border-navy/5 px-4 py-2.5">
                  <button
                    onClick={() => void doAction(listing.id, "approve")}
                    disabled={busy}
                    className="rounded border border-emerald-600 bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <input
                    value={rejectText[listing.id] ?? ""}
                    onChange={(e) => setRejectText((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                    placeholder="reject 理由（任意）"
                    className="flex-1 rounded border border-navy/15 px-2 py-1 text-[11px] text-navy placeholder-navy/30 focus:outline-none"
                  />
                  <button
                    onClick={() => void doAction(listing.id, "reject")}
                    disabled={busy}
                    className="rounded border border-red-300 px-3 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}

              {listing.status === "approved" && (
                <div className="flex items-center gap-3 border-t border-navy/5 px-4 py-2.5">
                  <button
                    onClick={() => void doAction(listing.id, "import")}
                    disabled={busy}
                    className="rounded border border-navy bg-navy px-4 py-1 text-[11px] font-medium text-white hover:bg-navy/80 disabled:opacity-40"
                  >
                    Price に Import
                  </button>
                  <button
                    onClick={() => void doAction(listing.id, "reject")}
                    disabled={busy}
                    className="text-[11px] text-red-400 hover:text-red-600"
                  >
                    Reject に戻す
                  </button>
                </div>
              )}

              {listing.rejectReason && (
                <p className="border-t border-navy/5 px-4 py-2 text-[11px] text-red-500">
                  reject理由: {listing.rejectReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded border border-navy/15 bg-white px-3 py-1.5 text-sm text-navy placeholder-navy/30 focus:border-navy/40 focus:outline-none";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-navy/10 text-navy/50",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-600",
    imported: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium ${map[status] ?? "bg-navy/10 text-navy/50"}`}>
      {status}
    </span>
  );
}
