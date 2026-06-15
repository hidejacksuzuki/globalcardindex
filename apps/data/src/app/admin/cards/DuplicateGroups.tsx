"use client";

import { useState } from "react";

export type DupCard = {
  id:          string;
  name:        string;
  setName:     string;
  rarity:      string;
  condition:   string;
  slug:        string | null;
  game:        string | null;
  priceCount:  number;
  latestPrice: number | null;
  isVisible:   boolean;
  deletedAt:   Date | null;
  mergedIntoCardId: string | null;
};

export type DupGroup = {
  key:   string;
  cards: DupCard[];
};

type Props = { groups: DupGroup[] };

export function DuplicateGroups({ groups: initial }: Props) {
  const [groups, setGroups] = useState<DupGroup[]>(initial);
  const [mergeTarget, setMergeTarget] = useState<DupGroup | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 表示中のグループ（全カードが非表示/削除済みなら非表示）
  const visible = groups.filter((g) =>
    g.cards.some((c) => !c.deletedAt && !c.mergedIntoCardId)
  );

  const handleVisibility = async (groupKey: string, cardId: string, isVisible: boolean) => {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/cards/${cardId}/visibility`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    if (json.ok) {
      setGroups((prev) => prev.map((g) =>
        g.key !== groupKey ? g :
        { ...g, cards: g.cards.map((c) => c.id === cardId ? { ...c, isVisible } : c) }
      ));
      setMsg(`✓ ${isVisible ? "表示" : "非表示"}にしました`);
    } else {
      setMsg(`✗ ${json.error ?? "エラー"}`);
    }
    setBusy(false);
  };

  const handleDelete = async (groupKey: string, card: DupCard) => {
    if (!confirm(`「${card.name}」を削除（soft delete）しますか？`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/cards/${card.id}/delete`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json() as { ok: boolean; card?: { deletedAt: string }; error?: string };
    if (json.ok) {
      setGroups((prev) => prev.map((g) =>
        g.key !== groupKey ? g :
        { ...g, cards: g.cards.map((c) => c.id === card.id ? { ...c, deletedAt: new Date(), isVisible: false } : c) }
      ));
      setMsg(`✓ 削除しました`);
    } else {
      setMsg(`✗ ${json.error ?? "エラー"}`);
    }
    setBusy(false);
  };

  if (visible.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1 text-xs uppercase tracking-widest text-navy/40">Potential Duplicates</h2>
      <p className="mb-4 text-[11px] text-navy/40">
        同じ normalizeCardKey になるカードが複数存在します。「グループ統合」で価格履歴を親に集約できます。
      </p>

      {msg && (
        <p className={`mb-3 text-xs ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</p>
      )}

      <div className="space-y-4">
        {visible.map((group) => (
          <div key={group.key} className="overflow-hidden rounded-lg border border-red-200 bg-white">
            {/* グループヘッダー */}
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-2.5">
              <div className="text-xs">
                <span className="font-medium text-red-700">Key: </span>
                <code className="font-mono text-red-600">{group.key}</code>
                <span className="ml-3 text-red-400">{group.cards.length} rows</span>
              </div>
              <button
                onClick={() => setMergeTarget(group)}
                disabled={busy}
                className="rounded border border-amber-500 bg-amber-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-600 disabled:opacity-40"
              >
                グループ統合
              </button>
            </div>

            {/* カード一覧 */}
            <table className="min-w-full divide-y divide-navy/5 text-sm">
              <thead className="bg-navy/[0.02] text-left text-xs uppercase tracking-wider text-navy/40">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Set</th>
                  <th className="px-4 py-2">Rarity</th>
                  <th className="px-4 py-2">Cond</th>
                  <th className="px-4 py-2 text-right">Prices</th>
                  <th className="px-4 py-2 text-right">Latest ¥</th>
                  <th className="px-4 py-2">状態</th>
                  <th className="px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {group.cards.map((c, idx) => {
                  const isDeleted = !!c.deletedAt;
                  const isMerged  = !!c.mergedIntoCardId;
                  const isHidden  = !c.isVisible && !isDeleted && !isMerged;
                  return (
                    <tr
                      key={c.id}
                      className={[
                        isDeleted ? "bg-red-50/50 opacity-60" :
                        isMerged  ? "bg-purple-50/30 opacity-60" :
                        isHidden  ? "bg-amber-50/30 opacity-70" :
                        idx === 0  ? "bg-green-50" : "bg-red-50/20",
                      ].join(" ")}
                    >
                      <td className="px-4 py-2 font-medium text-navy">{c.name}</td>
                      <td className="px-4 py-2 text-navy/60">{c.setName}</td>
                      <td className="px-4 py-2 text-navy/60">{c.rarity}</td>
                      <td className="px-4 py-2 text-navy/60">{c.condition}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-navy">
                        {c.priceCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-navy/60">
                        {c.latestPrice != null
                          ? `¥${c.latestPrice.toLocaleString()}`
                          : <span className="text-navy/25">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        {isDeleted ? (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">削除済</span>
                        ) : isMerged ? (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-600">統合済</span>
                        ) : isHidden ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">非表示</span>
                        ) : idx === 0 ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">最多データ</span>
                        ) : (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-500">重複候補</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {!isDeleted && !isMerged && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleVisibility(group.key, c.id, !c.isVisible)}
                              disabled={busy}
                              className="text-[11px] text-navy/40 underline underline-offset-2 hover:text-navy disabled:opacity-40"
                            >
                              {c.isVisible ? "非表示" : "表示"}
                            </button>
                            <button
                              onClick={() => void handleDelete(group.key, c)}
                              disabled={busy}
                              className="text-[11px] text-red-400 underline underline-offset-2 hover:text-red-600 disabled:opacity-40"
                            >
                              削除
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* 統合モーダル */}
      {mergeTarget && (
        <MergeModal
          group={mergeTarget}
          onClose={() => setMergeTarget(null)}
          onMerged={(parentId, childIds) => {
            setGroups((prev) => prev.map((g) =>
              g.key !== mergeTarget.key ? g : {
                ...g,
                cards: g.cards.map((c) =>
                  childIds.includes(c.id)
                    ? { ...c, isVisible: false, mergedIntoCardId: parentId }
                    : c
                ),
              }
            ));
            setMergeTarget(null);
            setMsg(`✓ 統合しました（${childIds.length}件 → 親 ${parentId.slice(0, 8)}…）`);
          }}
        />
      )}
    </section>
  );
}

// ── 統合モーダル ──────────────────────────────────────────────────────────────

function MergeModal({
  group,
  onClose,
  onMerged,
}: {
  group:    DupGroup;
  onClose:  () => void;
  onMerged: (parentId: string, childIds: string[]) => void;
}) {
  // 削除済み・統合済みを除いたカードのみ対象
  const candidates = group.cards.filter((c) => !c.deletedAt && !c.mergedIntoCardId);
  const [parentId, setParentId] = useState(candidates[0]?.id ?? "");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const childIds = candidates.filter((c) => c.id !== parentId).map((c) => c.id);

  const handleMerge = async () => {
    if (!parentId || childIds.length === 0) return;
    if (!confirm(`${childIds.length}件を統合します。続けますか？`)) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/cards/merge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, childIds }),
    });
    const json = await res.json() as { ok: boolean; error?: string };
    if (json.ok) {
      onMerged(parentId, childIds);
    } else {
      setErr(json.error ?? "エラー");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-navy/10 px-6 py-4">
          <h2 className="text-sm font-medium text-navy">グループ統合</h2>
          <p className="mt-0.5 text-xs text-navy/50">
            残す「親カード」を選択してください。他のカードの価格履歴は親に統合されます。
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          {candidates.map((c) => (
            <label key={c.id} className="flex items-start gap-3 cursor-pointer">
              <input type="radio" name="parent" value={c.id}
                checked={parentId === c.id} onChange={() => setParentId(c.id)}
                className="mt-1 accent-navy" />
              <div>
                <p className="text-sm font-medium text-navy">{c.name}</p>
                <p className="text-xs text-navy/50">
                  {c.setName} / {c.rarity} / {c.condition}
                  <span className="ml-2">価格: {c.priceCount}件</span>
                </p>
                {parentId === c.id && (
                  <span className="mt-0.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">親（残す）</span>
                )}
              </div>
            </label>
          ))}
        </div>
        {err && <p className="px-6 pb-2 text-xs text-red-600">✗ {err}</p>}
        <div className="flex justify-end gap-3 border-t border-navy/10 px-6 py-4">
          <button onClick={onClose} className="text-xs text-navy/40 hover:text-navy">キャンセル</button>
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
