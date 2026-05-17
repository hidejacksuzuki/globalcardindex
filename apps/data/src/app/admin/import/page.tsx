"use client";

import { useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportSummary = {
  ok:        boolean;
  totalRows: number;
  imported:  number;
  skipped:   number;
  duplicate: number;
  errors:    { row: number; reason: string }[];
  error?:    string;
};

type Phase = "idle" | "uploading" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-widest opacity-60">{label}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminImportPage() {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [file,     setFile]    = useState<File | null>(null);
  const [dryRun,   setDryRun]  = useState(true);
  const [phase,    setPhase]   = useState<Phase>("idle");
  const [summary,  setSummary] = useState<ImportSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── File selection ──────────────────────────────────────────────────────────
  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      alert("CSV ファイルのみ受け付けます（.csv）");
      return;
    }
    setFile(f);
    setSummary(null);
    setPhase("idle");
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0] ?? null);
    e.target.value = "";          // allow re-selecting the same file
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files[0] ?? null);
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setPhase("uploading");
    setSummary(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const url = `/api/v1/import/csv${dryRun ? "?dry=1" : ""}`;
      const res = await fetch(url, { method: "POST", body: form });
      const data: ImportSummary = await res.json();

      setSummary(data);
      setPhase(data.ok ? "done" : "error");
    } catch (err) {
      setSummary({
        ok: false,
        totalRows: 0, imported: 0, skipped: 0, duplicate: 0, errors: [],
        error: err instanceof Error ? err.message : "network error",
      });
      setPhase("error");
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setPhase("idle");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-navy">CSV Import</h1>
        <p className="mt-1 text-sm text-navy/50">
          GCI 標準フォーマットの CSV をアップロードしてカード価格データを一括インポートします。
        </p>
      </div>

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-3",
          "rounded-xl border-2 border-dashed px-6 py-14 text-center transition",
          dragOver
            ? "border-navy bg-navy/5"
            : file
            ? "border-green-400 bg-green-50"
            : "border-navy/20 hover:border-navy/40 hover:bg-navy/2",
        ].join(" ")}
      >
        {file ? (
          <>
            <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-navy">{file.name}</p>
              <p className="text-xs text-navy/40">{(file.size / 1024).toFixed(1)} KB — クリックして変更</p>
            </div>
          </>
        ) : (
          <>
            <svg className="h-10 w-10 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-sm font-medium text-navy/70">CSV ファイルをドロップ</p>
              <p className="text-xs text-navy/40">またはクリックして選択（最大 5 MB）</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* ── Options + actions ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-navy/70">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-navy/30 text-navy focus:ring-navy/20"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry-run（DB に書き込まず検証のみ）
        </label>

        <div className="ml-auto flex gap-3">
          {(file || summary) && (
            <button
              onClick={reset}
              className="rounded-lg border border-navy/20 px-4 py-2 text-sm text-navy/50 hover:border-navy/40 hover:text-navy/70 transition"
            >
              リセット
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={!file || phase === "uploading"}
            className={[
              "rounded-lg px-5 py-2 text-sm font-medium transition",
              !file || phase === "uploading"
                ? "cursor-not-allowed bg-navy/20 text-navy/30"
                : dryRun
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-navy text-white hover:bg-navy/80",
            ].join(" ")}
          >
            {phase === "uploading"
              ? "インポート中…"
              : dryRun
              ? "ドライラン実行"
              : "インポート実行"}
          </button>
        </div>
      </div>

      {/* ── Result summary ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="space-y-6 rounded-xl border border-navy/10 bg-white p-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            {summary.ok ? (
              <>
                <span className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  dryRun ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700",
                ].join(" ")}>
                  {dryRun ? "Dry-run 完了" : "Import 完了"}
                </span>
                <span className="text-sm text-navy/40">
                  {summary.totalRows} 行を処理しました
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                エラー
              </span>
            )}
          </div>

          {/* Stats grid */}
          {summary.ok && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Total"
                value={summary.totalRows}
                color="border-navy/10 bg-navy/3 text-navy"
              />
              <StatCard
                label={dryRun ? "Valid" : "Imported"}
                value={summary.imported}
                color="border-green-200 bg-green-50 text-green-800"
              />
              <StatCard
                label="Duplicate"
                value={summary.duplicate}
                color="border-amber-200 bg-amber-50 text-amber-800"
              />
              <StatCard
                label="Skipped"
                value={summary.skipped}
                color="border-red-200 bg-red-50 text-red-800"
              />
            </div>
          )}

          {/* Top-level error (non-row error) */}
          {summary.error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {summary.error}
            </p>
          )}

          {/* Row-level errors */}
          {summary.errors.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-navy/50">
                エラー詳細 ({summary.errors.length} 件)
              </h3>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-red-100 bg-red-50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-red-100 text-left">
                      <th className="px-3 py-2 font-semibold text-red-700 w-16">Row</th>
                      <th className="px-3 py-2 font-semibold text-red-700">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.errors.map((e, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-red-100/60 last:border-0"
                      >
                        <td className="px-3 py-1.5 tabular-nums text-red-600">{e.row}</td>
                        <td className="px-3 py-1.5 text-red-700">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dry-run call to action */}
          {summary.ok && dryRun && summary.imported > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Dry-run 結果が正常です。</strong>{" "}
              「Dry-run」チェックを外してから「インポート実行」を押すと DB に反映されます。
            </div>
          )}
        </div>
      )}

      {/* ── CSV format reference ─────────────────────────────────────────────── */}
      <details className="group rounded-xl border border-navy/10">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-3 text-sm font-medium text-navy/60 hover:text-navy transition">
          <span>GCI 標準 CSV フォーマット</span>
          <svg
            className="h-4 w-4 transition-transform group-open:rotate-180"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="border-t border-navy/10 px-5 py-4">
          <p className="mb-3 text-xs text-navy/50">必須列（灰色）と任意列（白）</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-navy/10 text-left">
                  <th className="py-1.5 pr-4 font-semibold text-navy/70">列名</th>
                  <th className="py-1.5 pr-4 font-semibold text-navy/70">必須</th>
                  <th className="py-1.5 font-semibold text-navy/70">説明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {[
                  ["Date",          "✓", "YYYY-MM-DD 形式"],
                  ["Card Name",     "✓", "カード名（表記統一済み）"],
                  ["Set",           "✓", "セット名"],
                  ["Rarity",        "✓", "レアリティ"],
                  ["Condition",     "✓", "状態（NM / LP / MP / HP / DMG）"],
                  ["Price",         "✓", "数値（整数 or 小数）"],
                  ["Currency",      "",  "通貨コード（デフォルト: JPY）"],
                  ["Source Type",   "",  "marketplace / store / auction etc."],
                  ["Source Name",   "",  "ソース名（例: Mercari）"],
                  ["URL/Reference", "",  "元URL（fingerprint に使用）"],
                  ["Listing Type",  "",  "buy_now / auction / offer etc."],
                  ["Seller Score",  "",  "0–100 の数値"],
                  ["Availability",  "",  "available / sold_out etc."],
                  ["Volume",        "",  "取引数"],
                  ["Observed By",   "",  "収集者名"],
                  ["Trust Score",   "",  "手動スコア（0.0–1.0）省略時は自動計算"],
                  ["Notes",         "",  "備考"],
                ].map(([col, req, desc]) => (
                  <tr key={col} className={req ? "bg-navy/2" : ""}>
                    <td className="py-1.5 pr-4 font-mono text-navy/80">{col}</td>
                    <td className="py-1.5 pr-4 text-center text-green-600">{req}</td>
                    <td className="py-1.5 text-navy/50">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
