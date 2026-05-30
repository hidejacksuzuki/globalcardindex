"use client";

/**
 * /admin/cards/auto-add
 * 複数行テキストからカード候補を自動推定・一括登録する。
 */

import { useState } from "react";

type DuplicateCard = { id: string; name: string } | null;

type Candidate = {
  id?:           string;
  inputText:     string;
  game:          string | null;
  name:          string;
  rarity:        string | null;
  version:       string | null;
  condition:     string;
  searchKeyword: string;
  confidence:    number;
  status?:       string;
  duplicateCard: DuplicateCard;
};

export default function AutoAddPage() {
  const [text,    setText]    = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  async function analyze() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true); setMsg(null);
    try {
      const res  = await fetch("/api/v1/cards/candidates", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lines }),
      });
      const json = await res.json() as { ok: boolean; candidates?: Candidate[]; error?: string };
      if (json.ok) {
        setResults(json.candidates ?? []);
        setMsg({ text: `${json.candidates?.length ?? 0}件 解析完了`, ok: true });
      } else {
        setMsg({ text: `エラー: ${json.error}`, ok: false });
      }
    } finally {
      setBusy(false);
    }
  }

  async function approve(idx: number) {
    const c = results[idx];
    if (!c?.id) return;
    const res  = await fetch(`/api/v1/cards/candidates/${c.id}/approve`, { method: "POST" });
    const json = await res.json() as { ok: boolean; error?: string };
    if (json.ok) {
      setResults((prev) =>
        prev.map((r, i) => i === idx ? { ...r, status: "approved" } : r),
      );
    } else {
      setMsg({ text: `登録失敗: ${json.error}`, ok: false });
    }
  }

  async function approveAll() {
    const targets = results.filter((r) => r.id && r.status !== "approved" && r.confidence >= 60);
    if (!targets.length) return;
    setBusy(true);
    let ok = 0;
    for (const c of targets) {
      if (!c.id) continue;
      const res = await fetch(`/api/v1/cards/candidates/${c.id}/approve`, { method: "POST" });
      const json = await res.json() as { ok: boolean };
      if (json.ok) ok++;
    }
    setResults((prev) =>
      prev.map((r) => targets.find((t) => t.id === r.id) ? { ...r, status: "approved" } : r),
    );
    setMsg({ text: `${ok}件 一括登録しました`, ok: true });
    setBusy(false);
  }

  function confBadge(n: number) {
    if (n >= 90) return "bg-green-100 text-green-700";
    if (n >= 60) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  }

  const pendingCount = results.filter((r) => r.status !== "approved" && r.confidence >= 60).length;

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="border-b border-navy/10 pb-4">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Cards</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Auto Add</h1>
        <p className="mt-1 text-sm text-navy/50">
          複数行テキストでカード候補を一括推定。confidence ≥ 90 は自動登録候補、60〜89 は要確認、59以下は保留。
        </p>
      </header>

      <div className="space-y-3">
        <label className="text-xs font-medium uppercase tracking-widest text-navy/50">
          カード情報（1行1カード）
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={
            "ナンジャモ SAR sv2D クレイバースト raw\nBlack Lotus Alpha PSA10\nモンキー・D・ルフィ SEC OP01 ROMANCE DAWN NM\n増殖するG 20thシークレット CHIM-JP049 raw"
          }
          className="w-full rounded border border-navy/20 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-navy/30"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => void analyze()}
            disabled={busy || !text.trim()}
            className="rounded bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/80 disabled:opacity-40"
          >
            {busy ? "解析中..." : "解析する"}
          </button>
          {pendingCount > 0 && (
            <button
              onClick={() => void approveAll()}
              disabled={busy}
              className="rounded border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-40"
            >
              confidence ≥ 60 を一括登録 ({pendingCount}件)
            </button>
          )}
          {msg && (
            <span className={`text-xs ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto border border-navy/10 bg-white">
          <table className="min-w-full divide-y divide-navy/10 text-sm">
            <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
              <tr>
                <th className="px-4 py-3">推定名</th>
                <th className="px-4 py-3">Game</th>
                <th className="px-4 py-3">Rarity</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Cond</th>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3 text-center">Conf</th>
                <th className="px-4 py-3">重複</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {results.map((r, i) => (
                <tr
                  key={i}
                  className={[
                    "hover:bg-navy/[0.02]",
                    r.status === "approved" ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 font-medium text-navy">{r.name}</td>
                  <td className="px-4 py-3 text-navy/60 text-xs">{r.game ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/60 text-xs">{r.rarity ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/60 text-xs">{r.version ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/60 text-xs">{r.condition}</td>
                  <td className="px-4 py-3 text-xs text-navy/40 max-w-xs truncate">
                    {r.searchKeyword}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${confBadge(r.confidence)}`}>
                      {r.confidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.duplicateCard
                      ? <span className="text-amber-600">⚠ {r.duplicateCard.name}</span>
                      : <span className="text-navy/25">なし</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "approved" ? (
                      <span className="text-xs text-green-600 font-medium">✓ 登録済み</span>
                    ) : r.id ? (
                      <button
                        onClick={() => void approve(i)}
                        className="rounded bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy/80"
                      >
                        登録
                      </button>
                    ) : (
                      <span className="text-xs text-navy/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border border-navy/10 bg-navy/[0.02] p-4 text-xs text-navy/50 space-y-1">
        <p className="font-medium text-navy">入力フォーマット</p>
        <p>1行1カード。以下の情報を空白区切りで入力してください:</p>
        <p className="font-mono">カード名 レアリティ セットコード [コンディション]</p>
        <p>コンディション: raw / NM / LP / PSA10 / PSA9</p>
      </div>
    </div>
  );
}
