"use client";

import { useState, useTransition } from "react";

export type CardRow = {
  id:          string;
  name:        string;
  setName:     string;
  rarity:      string;
  condition:   string;
  slug:        string | null;
  game:        string | null;
  priceCount:  number;
  latestPrice: number | null;
  latestAt:    Date   | null;
  createdAt:   Date;
  isVisible:   boolean;
  deletedAt:   Date | null;
  mergedIntoCardId: string | null;
};

// ── メインコンポーネント ─────────────────────────────────────────────────────

export function CardInventoryTable({ cards: initial }: { cards: CardRow[] }) {
  const [cards, setCards]       = useState<CardRow[]>(initial);
  const [query, setQuery]       = useState("");
  const [showDeleted, setShowDeleted]   = useState(false);
  const [showHidden,  setShowHidden]    = useState(true);
  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [, startTransition]     = useTransition();
  const [msg, setMsg]           = useState<string | null>(null);

  // フィルター
  const filtered = cards.filter((c) => {
    if (c.deletedAt && !showDeleted) return false;
    if (!c.isVisible && !c.deletedAt && !showHidden) return false;
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.setName.toLowerCase().includes(q) ||
      c.rarity.toLowerCase().includes(q) ||
      (c.game ?? "").toLowerCase().includes(q) ||
      c.condition.toLowerCase().includes(q)
    );
  });

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleVisibility = async (id: string, isVisible: boolean) => {
    const res = await fetch(`/api/admin/cards/${id}/visibility`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isVisible }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    if (json.ok) {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, isVisible } : c));
      setMsg(`✓ ${isVisible ? "表示" : "非表示"}にしました`);
    } else {
      setMsg(`✗ ${json.error ?? "エラー"}`);
    }
  };

  const handleDelete = async (card: CardRow) => {
    const isRestore = !!card.deletedAt;
    const label = isRestore ? "削除を取り消します" : `「${card.name}」を削除します（soft delete）`;
    if (!confirm(label + "\nよろしいですか？")) return;

    const res = await fetch(`/api/admin/cards/${card.id}/delete`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ restore: isRestore }),
    });
    const json = await res.json() as { ok: boolean; card?: { deletedAt: string | null; isVisible: boolean }; error?: string };
    if (json.ok && json.card) {
      setCards((prev) => prev.map((c) =>
        c.id === card.id
          ? { ...c, deletedAt: json.card!.deletedAt ? new Date(json.card!.deletedAt) : null, isVisible: json.card!.isVisible }
          : c
      ));
      setMsg(isRestore ? "✓ 削除を取り消しました" : "✓ 削除しました（soft delete）");
    } else {
      setMsg(`✗ ${json.error ?? "エラー"}`);
    }
  };

  const checkedCards = filtered.filter((c) => checked.has(c.id));

  return (
    <section className="space-y-4">
      {/* ── ツールバー ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xs uppercase tracking-widest text-navy/40">
          Card Inventory ({filtered.length.toLocaleString()}
          {query ? ` / ${cards.length.toLocaleString()}` : ""})
        </h2>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="カード名・セット・レアリティで絞り込み..."
          className="w-64 rounded border border-navy/20 px-3 py-1.5 text-xs text-navy placeholder:text-navy/30 outline-none focus:border-navy/50"
        />

        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-navy/50">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="accent-navy" />
          非表示を含む
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-navy/50">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="accent-navy" />
          削除済みを表示
        </label>

        {checkedCards.length >= 2 && (
          <button
            onClick={() => setMergeOpen(true)}
            className="rounded border border-amber-500 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
          >
            {checkedCards.length}件を統合
          </button>
        )}
      </div>

      {msg && (
        <p className={`text-xs ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</p>
      )}

      {/* ── テーブル ─────────────────────────────────────────────────────── */}
      {cards.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          No cards yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
          一致するカードが見つかりません。
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      setChecked(e.target.checked ? new Set(filtered.map((c) => c.id)) : new Set());
                    }}
                    checked={checked.size > 0 && filtered.every((c) => checked.has(c.id))}
                    className="accent-navy"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Rarity</th>
                <th className="px-4 py-3">Cond</th>
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3 text-right">Prices</th>
                <th className="px-4 py-3 text-right">Latest ¥</th>
                <th className="px-4 py-3">Last Observed</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map((c) => {
                const isDeleted = !!c.deletedAt;
                const isHidden  = !c.isVisible && !isDeleted;
                const isMerged  = !!c.mergedIntoCardId;
                return (
                  <tr
                    key={c.id}
                    className={[
                      isDeleted ? "bg-red-50/40 opacity-60" :
                      isHidden  ? "bg-amber-50/30 opacity-70" : "hover:bg-navy/[0.02]",
                      c.priceCount === 0 && !isDeleted ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={checked.has(c.id)}
                        onChange={() => toggleCheck(c.id)}
                        disabled={isDeleted}
                        className="accent-navy"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">{c.name}</td>
                    <td className="px-4 py-3 text-navy/60">{c.setName}</td>
                    <td className="px-4 py-3 text-navy/60">{c.rarity}</td>
                    <td className="px-4 py-3 text-navy/50">{c.condition}</td>
                    <td className="px-4 py-3 text-navy/40 text-xs">{c.game ?? <span className="text-navy/20">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.priceCount === 0 ? (
                        <span className="text-amber-500">0</span>
                      ) : (
                        <span className="text-navy">{c.priceCount.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy/70">
                      {c.latestPrice != null ? `¥${c.latestPrice.toLocaleString()}` : <span className="text-navy/25">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-navy/40 tabular-nums">
                      {c.latestAt ? new Date(c.latestAt).toLocaleDateString("ja-JP") : <span className="text-navy/25">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isDeleted ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">削除済</span>
                      ) : isMerged ? (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-600">統合済</span>
                      ) : isHidden ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">非表示</span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">表示中</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!isDeleted && (
                          <a href={`/admin/cards/${c.id}/collect`}
                            className="rounded bg-navy px-2 py-1 text-[11px] font-medium text-white hover:bg-navy/80">
                            Collect
                          </a>
                        )}
                        {!isDeleted && !isMerged && (
                          <button
                            onClick={() => {
                              startTransition(() => void handleVisibility(c.id, !c.isVisible));
                            }}
                            className="text-[11px] text-navy/40 underline underline-offset-2 hover:text-navy"
                          >
                            {c.isVisible ? "非表示" : "表示"}
                          </button>
                        )}
                        <button
                          onClick={() => startTransition(() => void handleDelete(c))}
                          className={`text-[11px] underline underline-offset-2 ${
                            isDeleted ? "text-emerald-600 hover:text-emerald-800" : "text-red-400 hover:text-red-600"
                          }`}
                        >
                          {isDeleted ? "復元" : "削除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 統合モーダル ──────────────────────────────────────────────────── */}
      {mergeOpen && (
        <MergeModal
          cards={checkedCards}
          onClose={() => setMergeOpen(false)}
          onMerged={(parentId, childIds) => {
            setCards((prev) => prev.map((c) =>
              childIds.includes(c.id)
                ? { ...c, isVisible: false, mergedIntoCardId: parentId }
                : c
            ));
            setChecked(new Set());
            setMergeOpen(false);
            setMsg(`✓ ${childIds.length}件を統合しました（親: ${parentId.slice(0, 8)}…）`);
          }}
        />
      )}
    </section>
  );
}

// ── 統合モーダル ──────────────────────────────────────────────────────────────

function MergeModal({
  cards,
  onClose,
  onMerged,
}: {
  cards:    CardRow[];
  onClose:  () => void;
  onMerged: (parentId: string, childIds: string[]) => void;
}) {
  const [parentId, setParentId] = useState(cards[0]?.id ?? "");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const childIds = cards.filter((c) => c.id !== parentId).map((c) => c.id);

  const handleMerge = async () => {
    if (!parentId || childIds.length === 0) return;
    if (!confirm(`${childIds.length}件を統合します。この操作は元に戻せません。続けますか？`)) return;

    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/cards/merge", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ parentId, childIds }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (json.ok) {
        onMerged(parentId, childIds);
      } else {
        setErr(json.error ?? "エラー");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-navy/10 px-6 py-4">
          <h2 className="text-sm font-medium text-navy">カード統合</h2>
          <p className="mt-0.5 text-xs text-navy/50">
            残す「親カード」を選択してください。他のカードは非表示になり、価格履歴は親に統合されます。
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {cards.map((c) => (
            <label key={c.id} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="parent"
                value={c.id}
                checked={parentId === c.id}
                onChange={() => setParentId(c.id)}
                className="mt-1 accent-navy"
              />
              <div>
                <p className="text-sm font-medium text-navy">{c.name}</p>
                <p className="text-xs text-navy/50">
                  {c.setName} / {c.rarity} / {c.condition}
                  <span className="ml-2 tabular-nums">価格: {c.priceCount}件</span>
                </p>
                {parentId === c.id && (
                  <span className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                    親（残す）
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        {err && <p className="px-6 pb-2 text-xs text-red-600">✗ {err}</p>}

        <div className="flex justify-end gap-3 border-t border-navy/10 px-6 py-4">
          <button
            onClick={onClose}
            className="text-xs text-navy/40 hover:text-navy"
          >
            キャンセル
          </button>
          <button
            onClick={() => void handleMerge()}
            disabled={busy || childIds.length === 0}
            className="rounded border border-amber-500 bg-amber-500 px-5 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-40"
          >
            {busy ? "統合中…" : `統合（${childIds.length}件 → 親）`}
          </button>
        </div>
      </div>
    </div>
  );
}
