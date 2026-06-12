"use client";

import { useState } from "react";

// ── 価格デフォルト ─────────────────────────────────────────────────────────────

type PriceDefault = { normalMin: number; normalMax: number; psa10Min: number; psa10Max: number };

const PRICE_DEFAULTS: Record<string, Record<string, PriceDefault>> = {
  pokemon: {
    SAR:              { normalMin: 3000,  normalMax: 50000,   psa10Min: 10000,  psa10Max: 200000  },
    SR:               { normalMin: 1000,  normalMax: 20000,   psa10Min: 3000,   psa10Max: 80000   },
    HR:               { normalMin: 2000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    SA:               { normalMin: 2000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    UR:               { normalMin: 2000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    SSR:              { normalMin: 2000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    AR:               { normalMin: 1000,  normalMax: 15000,   psa10Min: 3000,   psa10Max: 50000   },
    CHR:              { normalMin: 1000,  normalMax: 20000,   psa10Min: 3000,   psa10Max: 80000   },
    TR:               { normalMin: 500,   normalMax: 8000,    psa10Min: 1000,   psa10Max: 30000   },
    マスターボールミラー:   { normalMin: 1000,  normalMax: 15000,   psa10Min: 3000,   psa10Max: 50000   },
    プロモ:            { normalMin: 300,   normalMax: 8000,    psa10Min: 1000,   psa10Max: 30000   },
    旧裏:             { normalMin: 1000,  normalMax: 50000,   psa10Min: 5000,   psa10Max: 200000  },
  },
  onepiece: {
    SP:              { normalMin: 500,   normalMax: 15000,   psa10Min: 3000,   psa10Max: 50000   },
    リーダーパラレル:    { normalMin: 500,   normalMax: 10000,   psa10Min: 2000,   psa10Max: 30000   },
    "SEC パラレル":   { normalMin: 5000,  normalMax: 100000,  psa10Min: 20000,  psa10Max: 300000  },
    コミパラ:          { normalMin: 500,   normalMax: 10000,   psa10Min: 2000,   psa10Max: 30000   },
    手配書SP:          { normalMin: 500,   normalMax: 15000,   psa10Min: 3000,   psa10Max: 50000   },
    "SR パラレル":    { normalMin: 2000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    パラレル:          { normalMin: 300,   normalMax: 8000,    psa10Min: 1000,   psa10Max: 20000   },
  },
  yugioh: {
    "20thシークレット":         { normalMin: 3000,  normalMax: 100000,  psa10Min: 10000,  psa10Max: 300000  },
    プリズマティックシークレット:  { normalMin: 1000,  normalMax: 30000,   psa10Min: 5000,   psa10Max: 100000  },
    レリーフ:                  { normalMin: 500,   normalMax: 20000,   psa10Min: 2000,   psa10Max: 50000   },
    初期ウルトラ:               { normalMin: 500,   normalMax: 20000,   psa10Min: 2000,   psa10Max: 50000   },
    "25thシークレット":         { normalMin: 5000,  normalMax: 200000,  psa10Min: 20000,  psa10Max: 500000  },
    "10000シークレット":        { normalMin: 10000, normalMax: 300000,  psa10Min: 30000,  psa10Max: 1000000 },
  },
  mtg: {
    "":              { normalMin: 50000, normalMax: 5000000, psa10Min: 200000, psa10Max: 20000000 },
    "Borderless Foil": { normalMin: 50000, normalMax: 5000000, psa10Min: 200000, psa10Max: 20000000 },
  },
};

const RARITY_OPTIONS: Record<string, string[]> = {
  pokemon:  ["SAR", "SR", "HR", "SA", "UR", "SSR", "AR", "CHR", "TR", "マスターボールミラー", "プロモ", "旧裏"],
  onepiece: ["SP", "リーダーパラレル", "SEC パラレル", "コミパラ", "手配書SP", "SR パラレル", "パラレル"],
  yugioh:   ["20thシークレット", "プリズマティックシークレット", "レリーフ", "初期ウルトラ", "25thシークレット", "10000シークレット"],
  mtg:      ["Borderless Foil", "Foil", ""],
};

// ── コンポーネント ────────────────────────────────────────────────────────────

type Result = { ok: boolean; created?: number; skipped?: number; details?: string[]; error?: string };

export function AddCardForm() {
  const [open, setOpen]       = useState(true);
  const [game, setGame]       = useState("pokemon");
  const [name, setName]       = useState("");
  const [setName_, setSetName] = useState("");
  const [rarity, setRarity]   = useState("SAR");
  const [customRarity, setCustomRarity] = useState("");
  const [normalMin, setNormalMin] = useState(3000);
  const [normalMax, setNormalMax] = useState(50000);
  const [addPsa10, setAddPsa10]   = useState(true);
  const [psa10Min, setPsa10Min]   = useState(10000);
  const [psa10Max, setPsa10Max]   = useState(200000);
  const [busy, setBusy]           = useState(false);
  const [result, setResult]       = useState<Result | null>(null);

  const effectiveRarity = rarity === "__custom__" ? customRarity : rarity;

  const applyDefaults = (g: string, r: string) => {
    const defaults = PRICE_DEFAULTS[g]?.[r] ?? PRICE_DEFAULTS[g]?.[""];
    if (defaults) {
      setNormalMin(defaults.normalMin);
      setNormalMax(defaults.normalMax);
      setPsa10Min(defaults.psa10Min);
      setPsa10Max(defaults.psa10Max);
    }
  };

  const handleGameChange = (g: string) => {
    setGame(g);
    const firstRarity = RARITY_OPTIONS[g]?.[0] ?? "";
    setRarity(firstRarity);
    applyDefaults(g, firstRarity);
  };

  const handleRarityChange = (r: string) => {
    setRarity(r);
    if (r !== "__custom__") applyDefaults(game, r);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !setName_.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res  = await fetch("/api/v1/cards/quick-add", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          game, name: name.trim(), setName: setName_.trim(),
          rarity: effectiveRarity,
          normalMin, normalMax, addPsa10, psa10Min, psa10Max,
        }),
      });
      const json = await res.json() as Result;
      setResult(json);
      if (json.ok) {
        setName("");
        setSetName("");
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "通信エラー" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-navy/10 bg-white">
      {/* ヘッダー（クリックで開閉） */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-navy">新規カード登録</p>
          <p className="text-[11px] text-navy/40">ゲーム・レアリティを選ぶと価格範囲を自動補完します</p>
        </div>
        <span className="text-navy/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-navy/10 px-5 pb-6 pt-5 space-y-4">
          {/* ゲーム */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {["pokemon", "onepiece", "yugioh", "mtg"].map((g) => (
              <button
                key={g}
                onClick={() => handleGameChange(g)}
                className={[
                  "rounded border px-3 py-2 text-xs font-medium uppercase tracking-wide transition",
                  game === g
                    ? "border-navy bg-navy text-white"
                    : "border-navy/15 text-navy/50 hover:border-navy/30 hover:text-navy",
                ].join(" ")}
              >
                {g}
              </button>
            ))}
          </div>

          {/* カード名 / セット名 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="カード名">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ナンジャモ"
                className={inputCls}
              />
            </Field>
            <Field label="セット名">
              <input
                value={setName_}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="例: sv2D クレイバースト"
                className={inputCls}
              />
            </Field>
          </div>

          {/* レアリティ */}
          <Field label="レアリティ">
            <div className="flex flex-wrap gap-1.5">
              {RARITY_OPTIONS[game]?.map((r) => (
                <button
                  key={r || "(blank)"}
                  onClick={() => handleRarityChange(r)}
                  className={[
                    "rounded border px-2.5 py-1 text-xs transition",
                    rarity === r && rarity !== "__custom__"
                      ? "border-navy bg-navy text-white"
                      : "border-navy/15 text-navy/50 hover:border-navy/30 hover:text-navy",
                  ].join(" ")}
                >
                  {r || "(なし)"}
                </button>
              ))}
              <button
                onClick={() => handleRarityChange("__custom__")}
                className={[
                  "rounded border px-2.5 py-1 text-xs transition",
                  rarity === "__custom__"
                    ? "border-navy bg-navy text-white"
                    : "border-navy/15 text-navy/50 hover:border-navy/30 hover:text-navy",
                ].join(" ")}
              >
                その他…
              </button>
            </div>
            {rarity === "__custom__" && (
              <input
                value={customRarity}
                onChange={(e) => setCustomRarity(e.target.value)}
                placeholder="レアリティを入力"
                className={`${inputCls} mt-2`}
              />
            )}
          </Field>

          {/* 価格範囲（通常） */}
          <div className="rounded border border-navy/8 bg-navy/[0.02] p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-navy/40">通常版 (NM / LP)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="最低価格 (円)">
                <input type="number" value={normalMin} onChange={(e) => setNormalMin(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="最高価格 (円)">
                <input type="number" value={normalMax} onChange={(e) => setNormalMax(Number(e.target.value))} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* PSA10 */}
          <div className="rounded border border-navy/8 bg-navy/[0.02] p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addPsa10}
                onChange={(e) => setAddPsa10(e.target.checked)}
                className="accent-navy"
              />
              <span className="text-[10px] uppercase tracking-widest text-navy/40">PSA10 も追加</span>
            </label>
            {addPsa10 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="最低価格 (円)">
                  <input type="number" value={psa10Min} onChange={(e) => setPsa10Min(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="最高価格 (円)">
                  <input type="number" value={psa10Max} onChange={(e) => setPsa10Max(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
            )}
          </div>

          {/* プレビュー */}
          {name && setName_ && (
            <div className="rounded border border-navy/8 bg-slate-50 px-4 py-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-navy/30">登録プレビュー</p>
              <code className="block text-[11px] text-navy/60 font-mono break-all">
                {game},{name},{setName_},{effectiveRarity},"NM,LP",{normalMin},{normalMax},{name} {effectiveRarity} {setName_},true
              </code>
              {addPsa10 && (
                <code className="block text-[11px] text-navy/60 font-mono break-all">
                  {game},{name},{setName_},{effectiveRarity},"NM",{psa10Min},{psa10Max},{name} {effectiveRarity} {setName_} PSA10,true
                </code>
              )}
            </div>
          )}

          {/* 送信 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => void handleSubmit()}
              disabled={busy || !name.trim() || !setName_.trim()}
              className="rounded border border-navy bg-navy px-5 py-2 text-xs font-medium text-white transition hover:bg-navy/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "登録中…" : "DB に登録"}
            </button>
            {result && (
              <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
                {result.ok
                  ? `✓ 新規: ${result.created}件 / スキップ: ${result.skipped}件`
                  : `✗ ${result.error ?? "エラー"}`}
              </span>
            )}
          </div>

          {result?.ok && (result.created ?? 0) > 0 && (
            <p className="text-[11px] text-navy/40">
              watchlist.csv にも追記しました。git push → deploy で collector に反映されます。
            </p>
          )}
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
