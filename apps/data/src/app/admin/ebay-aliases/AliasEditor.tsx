"use client";

import { useState } from "react";

type CardAlias = {
  id:              string;
  cardId:          string;
  locale:          string;
  name:            string;
  setName:         string | null;
  cardNumber:      string | null;
  rarity:          string | null;
  language:        string | null;
  market:          string;
  searchQuery:     string | null;
  negativeKeywords: string;
  isPrimary:       boolean;
  card: {
    id:        string;
    name:      string;
    setName:   string;
    rarity:    string;
    condition: string;
    game:      string | null;
  };
  _count: { ebayListings: number };
};

type NewAliasForm = {
  cardId:           string;
  locale:           string;
  name:             string;
  setName:          string;
  cardNumber:       string;
  rarity:           string;
  language:         string;
  market:           string;
  searchQuery:      string;
  negativeKeywords: string;
  isPrimary:        boolean;
};

const DEFAULT_NEGATIVE = "PSA,BGS,CGC,graded,slab,proxy,custom,fan made,lot,bulk,sealed,booster,pack,box,case,digital,code";

type Props = {
  aliases: CardAlias[];
  cardId?: string;
};

export function AliasEditor({ aliases: initial, cardId }: Props) {
  const [aliases, setAliases] = useState<CardAlias[]>(initial);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [busy, setBusy]             = useState(false);
  const [msg, setMsg]               = useState<string | null>(null);

  const [form, setForm] = useState<NewAliasForm>({
    cardId:          cardId ?? "",
    locale:          "en",
    name:            "",
    setName:         "",
    cardNumber:      "",
    rarity:          "",
    language:        "Japanese",
    market:          "US",
    searchQuery:     "",
    negativeKeywords: DEFAULT_NEGATIVE,
    isPrimary:       false,
  });

  const patch = (field: keyof NewAliasForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleCreate = async () => {
    if (!form.cardId || !form.name) { setMsg("cardId と name は必須です"); return; }
    setBusy(true); setMsg(null);
    try {
      const res  = await fetch("/api/admin/ebay/aliases", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          cardId:          form.cardId,
          locale:          form.locale,
          name:            form.name,
          setName:         form.setName || undefined,
          cardNumber:      form.cardNumber || undefined,
          rarity:          form.rarity || undefined,
          language:        form.language || undefined,
          market:          form.market,
          searchQuery:     form.searchQuery || undefined,
          negativeKeywords: form.negativeKeywords,
          isPrimary:       form.isPrimary,
        }),
      });
      const json = await res.json() as { ok: boolean; alias?: CardAlias; error?: string };
      if (json.ok && json.alias) {
        setAliases((prev) => [json.alias as CardAlias, ...prev]);
        setCreating(false);
        setMsg("✓ 作成しました");
      } else {
        setMsg(`✗ ${json.error ?? "エラー"}`);
      }
    } finally { setBusy(false); }
  };

  const handleRegenerate = async (id: string) => {
    setBusy(true); setMsg(null);
    try {
      const res  = await fetch(`/api/admin/ebay/aliases/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ regenerateQuery: true }),
      });
      const json = await res.json() as { ok: boolean; alias?: CardAlias; error?: string };
      if (json.ok && json.alias) {
        setAliases((prev) => prev.map((a) => a.id === id ? json.alias as CardAlias : a));
        setMsg("✓ クエリを再生成しました");
      }
    } finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このエイリアスを削除しますか？")) return;
    setBusy(true); setMsg(null);
    try {
      await fetch(`/api/admin/ebay/aliases/${id}`, { method: "DELETE" });
      setAliases((prev) => prev.filter((a) => a.id !== id));
      setMsg("✓ 削除しました");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy/50">
          {aliases.length} 件のエイリアスが登録されています。
        </p>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded border border-navy bg-navy px-4 py-1.5 text-xs font-medium text-white hover:bg-navy/80"
        >
          ＋ 新規エイリアス
        </button>
      </div>

      {msg && (
        <p className={`text-xs ${msg.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{msg}</p>
      )}

      {/* 作成フォーム */}
      {creating && (
        <div className="rounded-lg border border-navy/10 bg-white p-5 space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-navy/40">新規エイリアス作成</p>

          {!cardId && (
            <Field label="Card ID">
              <input value={form.cardId} onChange={(e) => patch("cardId", e.target.value)}
                placeholder="cj..." className={inputCls} />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="英語カード名 *">
              <input value={form.name} onChange={(e) => patch("name", e.target.value)}
                placeholder="Charizard" className={inputCls} />
            </Field>
            <Field label="セット名">
              <input value={form.setName} onChange={(e) => patch("setName", e.target.value)}
                placeholder="Base Set" className={inputCls} />
            </Field>
            <Field label="カード番号">
              <input value={form.cardNumber} onChange={(e) => patch("cardNumber", e.target.value)}
                placeholder="4/102" className={inputCls} />
            </Field>
            <Field label="レアリティ">
              <input value={form.rarity} onChange={(e) => patch("rarity", e.target.value)}
                placeholder="Holo Rare" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="言語">
              <select value={form.language} onChange={(e) => patch("language", e.target.value)}
                className={inputCls}>
                <option value="Japanese">Japanese</option>
                <option value="English">English</option>
                <option value="Korean">Korean</option>
                <option value="Chinese">Chinese</option>
              </select>
            </Field>
            <Field label="市場">
              <select value={form.market} onChange={(e) => patch("market", e.target.value)}
                className={inputCls}>
                <option value="US">US</option>
                <option value="GLOBAL">GLOBAL</option>
              </select>
            </Field>
            <Field label="ロケール">
              <select value={form.locale} onChange={(e) => patch("locale", e.target.value)}
                className={inputCls}>
                <option value="en">en</option>
                <option value="ja">ja</option>
                <option value="ko">ko</option>
              </select>
            </Field>
          </div>

          <Field label="検索クエリ（空白なら自動生成）">
            <input value={form.searchQuery} onChange={(e) => patch("searchQuery", e.target.value)}
              placeholder="自動生成されます" className={inputCls} />
          </Field>

          <Field label="除外キーワード（カンマ区切り）">
            <textarea value={form.negativeKeywords}
              onChange={(e) => patch("negativeKeywords", e.target.value)}
              rows={2} className={`${inputCls} resize-none`} />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-navy/60">
            <input type="checkbox" checked={form.isPrimary}
              onChange={(e) => patch("isPrimary", e.target.checked)}
              className="accent-navy" />
            プライマリエイリアス（メイン検索クエリとして使用）
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void handleCreate()}
              disabled={busy}
              className="rounded border border-navy bg-navy px-5 py-2 text-xs text-white hover:bg-navy/80 disabled:opacity-40"
            >
              {busy ? "作成中…" : "作成"}
            </button>
            <button onClick={() => setCreating(false)}
              className="text-xs text-navy/40 hover:text-navy">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* エイリアス一覧 */}
      {aliases.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white p-8 text-center text-sm text-navy/40">
          エイリアスがありません。「＋ 新規エイリアス」から作成してください。
        </div>
      ) : (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/[0.02] text-left text-[10px] uppercase tracking-widest text-navy/40">
              <tr>
                <th className="px-4 py-3">カード</th>
                <th className="px-4 py-3">英語名</th>
                <th className="px-4 py-3">番号</th>
                <th className="px-4 py-3">言語</th>
                <th className="px-4 py-3">市場</th>
                <th className="px-4 py-3">検索クエリ</th>
                <th className="px-4 py-3 text-right">Listings</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {aliases.map((alias) => (
                <tr key={alias.id} className="hover:bg-navy/[0.01]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy">{alias.card.name}</div>
                    <div className="text-[11px] text-navy/40">{alias.card.setName}</div>
                    {alias.isPrimary && (
                      <span className="inline-block rounded bg-navy/10 px-1.5 py-0.5 text-[10px] text-navy/60">
                        Primary
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">{alias.name}</td>
                  <td className="px-4 py-3 text-navy/60">{alias.cardNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/60">{alias.language ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-navy/15 px-2 py-0.5 text-[10px] text-navy/60">
                      {alias.market}
                    </span>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-mono text-[11px] text-navy/50">
                    {alias.searchQuery ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-navy/60">
                    {alias._count.ebayListings}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleRegenerate(alias.id)}
                        disabled={busy}
                        className="text-[11px] text-navy/40 underline underline-offset-2 hover:text-navy"
                      >
                        再生成
                      </button>
                      <button
                        onClick={() => void handleDelete(alias.id)}
                        disabled={busy}
                        className="text-[11px] text-red-400 underline underline-offset-2 hover:text-red-600"
                      >
                        削除
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

// ── helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded border border-navy/15 bg-white px-3 py-1.5 text-sm text-navy placeholder-navy/30 focus:border-navy/40 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      {children}
    </div>
  );
}
