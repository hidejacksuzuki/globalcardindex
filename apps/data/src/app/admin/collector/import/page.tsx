"use client";

/**
 * /admin/collector/import
 *
 * Manual paste UI for collected Mercari listings.
 *
 * Workflow:
 *   1. Paste a JSON array of raw Mercari items into the text area
 *   2. Click "Preview" — normalize titles, run filters, show result table
 *   3. Review: green rows will be sent, red rows are filtered/flagged
 *   4. Click "Submit Passing" — POSTs to /api/v1/prices/bulk
 *   5. Results summary shown
 *
 * Expected JSON shape (flexible — only title + price required):
 * [
 *   {
 *     "name":      "リザードン ex SAR 美品",
 *     "price":     28000,
 *     "url":       "https://jp.mercari.com/item/mXXXXX",
 *     "condition": "NM",    // optional — inferred from title if absent
 *     "cardName":  "リザードン ex",  // optional metadata
 *     "set":       "SV4a 深緋の仮面",
 *     "rarity":    "SAR"
 *   }
 * ]
 */

import { useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawItem = {
  name?:      string;
  title?:     string;   // alias for name
  price?:     number | string;
  url?:       string;
  condition?: string;
  cardName?:  string;
  set?:       string;
  rarity?:    string;
  [key: string]: unknown;
};

type PreviewRow = {
  idx:            number;
  rawTitle:       string;
  rawPrice:       number;
  url:            string | null;
  condition:      string | null;
  cardName:       string | null;
  set:            string | null;
  rarity:         string | null;
  // filter result
  pass:           boolean;
  filterReason:   string | null;
  // normalized
  normalizedTitle: string;
};

type SubmitResult = {
  ok:        boolean;
  imported:  number;
  duplicate: number;
  skipped:   number;
  errors:    { row: number; reason: string }[];
  error?:    string;
};

type Phase = "idle" | "previewed" | "submitting" | "done" | "error";

// ── Normalization (inline — mirrors packages/core for browser context) ────────

function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}
function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function normalizeTitle(input: string): string {
  let s = toHalfWidth(input);
  s = kataToHira(s);
  s = s.replace(/[【】「」『』〔〕（）\(\)\[\]]/g, " ");
  s = s.replace(/[★☆◆◇■□▲▼●○♠♣♥♦※†‡◎♪]/g, " ");
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Filter (inline) ───────────────────────────────────────────────────────────

const NG_WORDS = [
  "proxy","コピー","偽物","レプリカ","スーパーコピー","偽",
  "スリーブのみ","スリーブ付き","ケースのみ","ケース付き",
  "まとめ","セット売り","複数枚",
  "psa ","psa10","psa9","bgs ","cgc ","ace ",
  "ジャンク","状態悪","傷あり","書き込み","折れ","欠け",
];

const COND_PATTERNS: Array<[RegExp, string]> = [
  [/美品|nm|near.?mint/i,         "NM"],
  [/良品|lp|light.?play/i,         "LP"],
  [/中程度|mp|moderate.?play/i,    "MP"],
  [/傷あり|ひどい|hp|heavy.?play/i,"HP"],
  [/ダメージ|ボロ|dmg|damaged/i,   "DMG"],
];

function inferCondition(title: string): string | null {
  for (const [re, cond] of COND_PATTERNS) if (re.test(title)) return cond;
  return null;
}

function runFilter(
  rawTitle: string,
  price:    number,
  minPrice?: number,
  maxPrice?: number,
): { pass: boolean; reason: string | null } {
  const norm = normalizeTitle(rawTitle);
  for (const word of NG_WORDS) {
    if (norm.includes(normalizeTitle(word))) {
      return { pass: false, reason: `ng_word: "${word}"` };
    }
  }
  if (minPrice != null && price < minPrice)
    return { pass: false, reason: `price_too_low (¥${price.toLocaleString()} < ¥${minPrice.toLocaleString()})` };
  if (maxPrice != null && price > maxPrice)
    return { pass: false, reason: `price_too_high (¥${price.toLocaleString()} > ¥${maxPrice.toLocaleString()})` };
  if (!Number.isFinite(price) || price <= 0)
    return { pass: false, reason: `invalid_price: ${price}` };
  return { pass: true, reason: null };
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PLACEHOLDER = JSON.stringify([
  {
    name:     "リザードン ex SAR 美品",
    price:    28000,
    url:      "https://jp.mercari.com/item/mXXXXX",
    cardName: "リザードン ex",
    set:      "SV4a 深緋の仮面",
    rarity:   "SAR",
  },
  {
    name:  "リザードン ex SAR まとめ売り",
    price: 90000,
    url:   "https://jp.mercari.com/item/mYYYYY",
  },
], null, 2);

export default function CollectorImportPage() {
  const [raw,       setRaw]       = useState("");
  const [source,    setSource]    = useState("mercari");
  const [cardName,  setCardName]  = useState("");
  const [setName,   setSetName]   = useState("");
  const [rarity,    setRarity]    = useState("");
  const [condition, setCondition] = useState("");
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [rows,      setRows]      = useState<PreviewRow[]>([]);
  const [phase,     setPhase]     = useState<Phase>("idle");
  const [result,    setResult]    = useState<SubmitResult | null>(null);
  const [parseErr,  setParseErr]  = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ── Preview ────────────────────────────────────────────────────────────────
  const handlePreview = useCallback(() => {
    setParseErr(null);
    setResult(null);

    let items: RawItem[];
    try {
      const parsed = JSON.parse(raw.trim());
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
      items = parsed;
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "invalid JSON");
      return;
    }

    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;

    const preview: PreviewRow[] = items.map((item, idx) => {
      const rawTitle = String(item.name ?? item.title ?? "").trim();
      const rawPrice = Number(item.price ?? 0);
      const url      = item.url ? String(item.url) : null;
      const normTitle = normalizeTitle(rawTitle);
      const { pass, reason } = runFilter(rawTitle, rawPrice, min, max);
      const inferredCond = inferCondition(rawTitle);

      return {
        idx,
        rawTitle,
        rawPrice,
        url,
        condition:       condition || item.condition ? String(item.condition ?? condition) : inferredCond,
        cardName:        cardName  || item.cardName  ? String(item.cardName  ?? cardName)  : null,
        set:             setName   || item.set       ? String(item.set       ?? setName)   : null,
        rarity:          rarity    || item.rarity    ? String(item.rarity    ?? rarity)    : null,
        pass,
        filterReason:    reason,
        normalizedTitle: normTitle,
      };
    });

    setRows(preview);
    setPhase("previewed");
  }, [raw, condition, cardName, setName, rarity, minPrice, maxPrice]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const passing = rows.filter((r) => r.pass);
    if (passing.length === 0) return;
    setPhase("submitting");

    const today = new Date().toISOString().slice(0, 10);

    const payload = passing.map((r) => ({
      date:        today,
      cardName:    r.cardName   ?? r.normalizedTitle,
      set:         r.set        ?? "unknown",
      rarity:      r.rarity     ?? "unknown",
      condition:   r.condition  ?? "unknown",
      price:       r.rawPrice,
      currency:    "JPY",
      sourceType:  "marketplace",
      sourceName:  source,
      url:         r.url        ?? undefined,
      listingType: "buy_now",
      notes:       `collector-import: ${r.rawTitle.slice(0, 80)}`,
    }));

    try {
      const res  = await fetch("/api/v1/prices/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data: SubmitResult = await res.json();
      setResult(data);
      setPhase(data.ok ? "done" : "error");
    } catch (err) {
      setResult({
        ok: false, imported: 0, duplicate: 0, skipped: 0, errors: [],
        error: err instanceof Error ? err.message : "network error",
      });
      setPhase("error");
    }
  }, [rows, source]);

  // ── Save to Review Queue ──────────────────────────────────────────────────
  const handleSaveToQueue = useCallback(async () => {
    if (rows.length === 0) return;
    setPhase("submitting");
    setSessionId(null);

    let parsedItems: RawItem[];
    try {
      parsedItems = JSON.parse(raw.trim());
    } catch {
      setPhase("error");
      return;
    }

    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;

    try {
      const res  = await fetch("/api/v1/collector/session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          source:   source    || "mercari",
          cardName: cardName  || undefined,
          setName:  setName   || undefined,
          rarity:   rarity    || undefined,
          minPrice: min,
          maxPrice: max,
          items:    parsedItems,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSessionId(data.sessionId);
        setPhase("done");
      } else {
        setPhase("error");
        setResult({ ok: false, imported: 0, duplicate: 0, skipped: 0, errors: [],
          error: data.error ?? "failed to save session" });
      }
    } catch (err) {
      setPhase("error");
      setResult({ ok: false, imported: 0, duplicate: 0, skipped: 0, errors: [],
        error: err instanceof Error ? err.message : "network error" });
    }
  }, [rows, raw, source, cardName, setName, rarity, minPrice, maxPrice]);

  const passCount   = rows.filter((r) =>  r.pass).length;
  const filterCount = rows.filter((r) => !r.pass).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Collector</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Import Listings</h1>
        <p className="mt-1 text-sm text-navy/50">
          Mercari の出品データを JSON で貼り付け、フィルタリング後に一括投入します。
        </p>
      </header>

      {/* Sub-nav */}
      <CollectorSubNav active="import" />

      {/* ── Metadata fields ────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Source"    value={source}    onChange={setSource}    placeholder="mercari" />
        <Field label="Card Name" value={cardName}  onChange={setCardName}  placeholder="リザードン ex" />
        <Field label="Set"       value={setName}   onChange={setSetName}   placeholder="SV4a 深緋の仮面" />
        <Field label="Rarity"    value={rarity}    onChange={setRarity}    placeholder="SAR" />
        <Field label="Min Price" value={minPrice}  onChange={setMinPrice}  placeholder="15000" type="number" />
        <Field label="Max Price" value={maxPrice}  onChange={setMaxPrice}  placeholder="45000" type="number" />
      </section>
      <p className="mt-1 text-[11px] text-navy/40">
        カード名・セット・レアリティは JSON 内に同フィールドがあればそちらが優先されます。未入力の場合は "unknown" が入ります。
      </p>

      {/* ── JSON paste area ────────────────────────────────────────────────── */}
      <section>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-navy/50">
          JSON Listings Array
        </label>
        <textarea
          className="h-56 w-full rounded-lg border border-navy/20 bg-white p-3 font-mono text-xs text-navy focus:border-navy/50 focus:outline-none resize-y"
          placeholder={PLACEHOLDER}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setPhase("idle"); setRows([]); }}
          spellCheck={false}
        />
        {parseErr && (
          <p className="mt-1 text-xs text-red-600">Parse error: {parseErr}</p>
        )}
      </section>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handlePreview}
          disabled={!raw.trim()}
          className={[
            "rounded-lg px-5 py-2 text-sm font-medium transition",
            raw.trim()
              ? "bg-navy text-white hover:bg-navy/80"
              : "cursor-not-allowed bg-navy/20 text-navy/30",
          ].join(" ")}
        >
          Preview & Filter
        </button>

        {phase === "previewed" && rows.length > 0 && (
          <>
            {/* PRIMARY: save to review queue */}
            <button
              onClick={handleSaveToQueue}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-medium text-white hover:bg-navy/80 transition"
            >
              Save {rows.length} to Review Queue →
            </button>

            {/* SECONDARY: quick import (skip review) */}
            {passCount > 0 && (
              <button
                onClick={handleSubmit}
                className="rounded-lg border border-navy/30 px-4 py-2 text-sm text-navy/60 hover:border-navy/50 hover:text-navy/80 transition"
                title="フィルター通過アイテムのみ即時投入（レビューをスキップ）"
              >
                Quick import {passCount} passing
              </button>
            )}
          </>
        )}

        {phase === "submitting" && (
          <span className="text-sm text-navy/50">Saving…</span>
        )}

        {rows.length > 0 && (
          <span className="ml-auto text-xs text-navy/40">
            {passCount} pass / {filterCount} filtered
          </span>
        )}
      </div>

      {/* ── Queue saved confirmation ──────────────────────────────────────── */}
      {phase === "done" && sessionId && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-medium text-green-800">
            ✓ {rows.length} items saved to review queue
          </p>
          <p className="mt-1 text-xs text-green-700">
            Session:{" "}
            <code className="font-mono">{sessionId}</code>
          </p>
          <a
            href={`/admin/collector/review?session=${encodeURIComponent(sessionId)}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 transition"
          >
            Go to Review →
          </a>
        </div>
      )}

      {/* ── Submit result ──────────────────────────────────────────────────── */}
      {result && (
        <div className={`rounded-lg border p-5 ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-sm font-medium text-navy">
            {result.ok ? "✓ Submit complete" : "✗ Submit error"}
          </p>
          {result.ok && (
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-green-700">+{result.imported} imported</span>
              {result.duplicate > 0 && <span className="text-amber-600">{result.duplicate} duplicate</span>}
              {result.skipped   > 0 && <span className="text-red-600">{result.skipped} skipped</span>}
            </div>
          )}
          {result.error && <p className="mt-1 text-xs text-red-700">{result.error}</p>}
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>Row {e.row}: {e.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Preview table ──────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
            Preview ({rows.length} items)
          </h2>
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-xs">
              <thead className="bg-navy/5 text-left text-[10px] uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-3 py-2 w-8">#</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Raw Title</th>
                  <th className="px-3 py-2">Normalized</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2">Cond</th>
                  <th className="px-3 py-2">Filter Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {rows.map((row) => (
                  <tr
                    key={row.idx}
                    className={row.pass ? "bg-green-50/40" : "bg-red-50/40 opacity-70"}
                  >
                    <td className="px-3 py-2 text-navy/30 tabular-nums">{row.idx + 1}</td>
                    <td className="px-3 py-2">
                      {row.pass ? (
                        <span className="text-green-700 font-semibold">✓ Pass</span>
                      ) : (
                        <span className="text-red-600 font-semibold">✗ Filter</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-navy/70">{row.rawTitle}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-navy/40 font-mono">{row.normalizedTitle}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">
                      ¥{row.rawPrice.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-navy/60">{row.condition ?? "—"}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-red-600">
                      {row.filterReason ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CollectorSubNav({ active }: { active: "urls" | "import" | "review" | "runs" }) {
  const items = [
    { href: "/admin/collector",        label: "URL Preview", key: "urls"   },
    { href: "/admin/collector/import", label: "Import",      key: "import" },
    { href: "/admin/collector/review", label: "Review",      key: "review" },
    { href: "/admin/collector/runs",   label: "Runs",        key: "runs"   },
  ];
  return (
    <div className="flex gap-1 border-b border-navy/10">
      {items.map(({ href, label, key }) => (
        <Link
          key={key}
          href={href}
          className={[
            "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
            active === key
              ? "border-navy text-navy font-medium"
              : "border-transparent text-navy/40 hover:text-navy/60",
          ].join(" ")}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  type?:       string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-navy/40">{label}</label>
      <input
        type={type}
        className="w-full rounded border border-navy/20 bg-white px-2.5 py-1.5 text-xs text-navy placeholder-navy/25 focus:border-navy/40 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
