"use client";

/**
 * /admin/collector/review
 *
 * Manual review interface for CollectorRun items.
 *
 * Features:
 *   – Tab filter: Pending / Filtered / Imported / All
 *   – Optional ?session=SESSION_ID URL param to focus on one batch
 *   – Per-row: Edit (inline), Approve, Reject
 *   – Median deviation warning badge (loaded from /api/v1/collector/review-data)
 *   – Bulk approve-all-pending button
 *   – Auto-refreshes after each action
 */

import {
  useState, useEffect, useCallback, useRef, type ChangeEvent, Suspense,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type RunItem = {
  id:              string;
  sessionId:       string;
  source:          string;
  cardName:        string | null;
  setName:         string | null;
  rarity:          string | null;
  condition:       string | null;
  status:          string;
  rawTitle:        string | null;
  rawPrice:        number | null;
  rawUrl:          string | null;
  normalizedTitle: string | null;
  normalizedPrice: number | null;
  filterReason:    string | null;
  importedAt:      string | null;
  createdAt:       string;
  // client-enriched
  medianWarning?:  "low" | "high" | null;
  medianRatio?:    number | null;
  medianValue?:    number | null;
};

type TabKey = "pending" | "filtered" | "imported" | "all";

const TABS: { key: TabKey; label: string; color: string }[] = [
  { key: "pending",  label: "Pending",  color: "text-amber-700 border-amber-500" },
  { key: "filtered", label: "Filtered", color: "text-red-600 border-red-400"     },
  { key: "imported", label: "Imported", color: "text-green-700 border-green-500" },
  { key: "all",      label: "All",      color: "text-navy border-navy"           },
];

// ── Inline normalization (mirrors core) ───────────────────────────────────────
function normalizeTitle(s: string): string {
  s = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/　/g, " ");
  s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  s = s.replace(/[【】「」『』〔〕（）\(\)\[\]]/g, " ");
  s = s.replace(/[★☆◆◇■□▲▼●○]/g, " ");
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectorReviewPage() {
  return (
    <Suspense>
      <CollectorReviewInner />
    </Suspense>
  );
}

function CollectorReviewInner() {
  const searchParams = useSearchParams();
  const focusSession = searchParams.get("session");

  const [tab,      setTab]      = useState<TabKey>("pending");
  const [items,    setItems]    = useState<RunItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);   // spinner per row
  const [editId,   setEditId]   = useState<string | null>(null);   // inline edit open
  const [editData, setEditData] = useState<Partial<RunItem>>({});
  const [toast,    setToast]    = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = focusSession ? `?session=${encodeURIComponent(focusSession)}` : "";
      const res  = await fetch(`/api/v1/collector/review-data${qs}`);
      const data = await res.json();
      if (data.ok) setItems(data.items as RunItem[]);
    } finally {
      setLoading(false);
    }
  }, [focusSession]);

  useEffect(() => { load(); }, [load]);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const patchItem = useCallback(async (
    id:   string,
    body: object,
    successMsg: string,
  ) => {
    setActionId(id);
    try {
      const res  = await fetch(`/api/v1/collector/items/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("ok", successMsg);
        await load();
      } else {
        showToast("err", data.error ?? "action failed");
      }
    } catch {
      showToast("err", "network error");
    } finally {
      setActionId(null);
      setEditId(null);
    }
  }, [load]);

  const handleApprove = (id: string) =>
    patchItem(id, { action: "approve" }, "Approved & imported ✓");

  const handleReject = (id: string, reason: string) =>
    patchItem(id, { action: "reject", rejectReason: reason }, "Rejected");

  const handleEdit = (id: string) =>
    patchItem(id, { action: "edit", edits: editData }, "Edits saved");

  const handleApproveWithEdits = async (id: string) => {
    await patchItem(id, { action: "edit", edits: editData }, "");
    await patchItem(id, { action: "approve" }, "Approved with edits ✓");
  };

  const handleBulkApprove = async () => {
    const pending = filtered.filter((r) => r.status === "pending");
    for (const item of pending) {
      await patchItem(item.id, { action: "approve" }, "");
    }
    showToast("ok", `Bulk approved ${pending.length} items`);
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const filtered = tab === "all"
    ? items
    : items.filter((i) => i.status === tab);

  const counts = {
    pending:  items.filter((i) => i.status === "pending").length,
    filtered: items.filter((i) => i.status === "filtered").length,
    imported: items.filter((i) => i.status === "imported").length,
    all:      items.length,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin › Collector</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Review Queue</h1>
        <p className="mt-1 text-sm text-navy/50">
          収集アイテムを手動で確認・編集・承認・却下します。
          {focusSession && (
            <span className="ml-2 rounded bg-navy/10 px-2 py-0.5 font-mono text-xs text-navy/60">
              {focusSession}
            </span>
          )}
        </p>
      </header>

      <CollectorSubNav active="review" />

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-navy/10">
        {TABS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              "px-4 py-2 text-xs uppercase tracking-widest transition -mb-px border-b-2",
              tab === key
                ? `${color} font-semibold`
                : "border-transparent text-navy/40 hover:text-navy/60",
            ].join(" ")}
          >
            {label}
            <span className="ml-1.5 rounded-full bg-navy/10 px-1.5 py-0.5 text-[9px] tabular-nums">
              {counts[key]}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          {tab === "pending" && counts.pending > 0 && (
            <button
              onClick={handleBulkApprove}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
            >
              Approve all {counts.pending} pending
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-navy/20 px-3 py-1.5 text-xs text-navy/50 hover:border-navy/40 hover:text-navy/70 transition"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${
          toast.type === "ok"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Item list ────────────────────────────────────────────────────────── */}
      {loading && items.length === 0 ? (
        <p className="text-sm text-navy/40">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-navy/40">
          {tab === "pending" ? "承認待ちのアイテムはありません。" : "アイテムがありません。"}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              isEditing={editId === item.id}
              editData={editId === item.id ? editData : {}}
              isActing={actionId === item.id}
              onEditOpen={() => {
                setEditId(item.id);
                setEditData({
                  cardName:        item.cardName   ?? "",
                  setName:         item.setName    ?? "",
                  rarity:          item.rarity     ?? "",
                  condition:       item.condition  ?? "",
                  normalizedPrice: item.normalizedPrice ?? item.rawPrice ?? undefined,
                  rawUrl:          item.rawUrl     ?? "",
                  normalizedTitle: item.normalizedTitle ?? item.rawTitle ?? "",
                });
              }}
              onEditClose={() => setEditId(null)}
              onEditChange={(field, value) => setEditData((prev) => ({ ...prev, [field]: value }))}
              onApprove={() => handleApprove(item.id)}
              onApproveWithEdits={() => handleApproveWithEdits(item.id)}
              onReject={(reason) => handleReject(item.id, reason)}
              onSaveEdits={() => handleEdit(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

type ReviewCardProps = {
  item:              RunItem;
  isEditing:         boolean;
  editData:          Partial<RunItem>;
  isActing:          boolean;
  onEditOpen:        () => void;
  onEditClose:       () => void;
  onEditChange:      (field: keyof RunItem, value: string | number) => void;
  onApprove:         () => void;
  onApproveWithEdits:() => void;
  onReject:          (reason: string) => void;
  onSaveEdits:       () => void;
};

function ReviewCard({
  item, isEditing, editData, isActing,
  onEditOpen, onEditClose, onEditChange,
  onApprove, onApproveWithEdits, onReject, onSaveEdits,
}: ReviewCardProps) {
  const [rejectReason, setRejectReason] = useState("");

  const price        = item.normalizedPrice ?? item.rawPrice;
  const displayTitle = item.normalizedTitle ?? item.rawTitle ?? "—";

  const borderColor =
    item.status === "imported" ? "border-green-200 bg-green-50/30" :
    item.status === "filtered" ? "border-red-200 bg-red-50/30"     :
    item.medianWarning         ? "border-amber-300 bg-amber-50/30" :
    "border-navy/10 bg-white";

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        {/* Status */}
        <StatusDot status={item.status} />

        {/* Card info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-navy">
            {item.cardName ?? displayTitle}
          </p>
          <p className="text-xs text-navy/50">
            {[item.setName, item.rarity, item.condition].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Price + warnings */}
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-navy">
            {price != null ? `¥${price.toLocaleString()}` : "—"}
          </p>
          {item.medianWarning && (
            <MedianBadge
              warning={item.medianWarning}
              ratio={item.medianRatio}
              median={item.medianValue}
            />
          )}
        </div>

        {/* Actions (pending only) */}
        {item.status === "pending" && !isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={onApprove}
              disabled={isActing}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {isActing ? "…" : "Approve"}
            </button>
            <button
              onClick={onEditOpen}
              className="rounded-md border border-navy/20 px-3 py-1 text-xs text-navy/60 hover:border-navy/40 hover:text-navy transition"
            >
              Edit
            </button>
          </div>
        )}

        {item.status === "pending" && !isEditing && (
          <RejectButton onReject={onReject} />
        )}
      </div>

      {/* ── Raw title + URL ── */}
      <div className="border-t border-navy/5 px-4 py-2 text-xs text-navy/40 space-y-0.5">
        <p className="truncate"><span className="text-navy/30">Raw: </span>{item.rawTitle ?? "—"}</p>
        {item.rawUrl && (
          <p className="truncate">
            <span className="text-navy/30">URL: </span>
            <a href={item.rawUrl} target="_blank" rel="noopener noreferrer"
               className="text-navy/50 underline underline-offset-2 hover:text-navy">
              {item.rawUrl}
            </a>
          </p>
        )}
        {item.filterReason && (
          <p className="flex items-center gap-2 flex-wrap">
            <FilterCategoryBadge reason={item.filterReason} />
            <span className="text-xs text-navy/40">{item.filterReason}</span>
          </p>
        )}
      </div>

      {/* ── Inline edit form ── */}
      {isEditing && (
        <div className="border-t border-navy/10 bg-navy/[0.02] px-4 py-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-navy/50">Edit before import</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <EditField label="Card Name"  value={String(editData.cardName  ?? "")} onChange={(v) => onEditChange("cardName",  v)} />
            <EditField label="Set"        value={String(editData.setName   ?? "")} onChange={(v) => onEditChange("setName",   v)} />
            <EditField label="Rarity"     value={String(editData.rarity    ?? "")} onChange={(v) => onEditChange("rarity",    v)} />
            <EditField label="Condition"  value={String(editData.condition ?? "")} onChange={(v) => onEditChange("condition", v)} />
            <EditField label="Price"      value={String(editData.normalizedPrice ?? "")} type="number"
                       onChange={(v) => onEditChange("normalizedPrice", Number(v))} />
            <EditField label="URL"        value={String(editData.rawUrl ?? "")} onChange={(v) => onEditChange("rawUrl", v)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onApproveWithEdits}
              disabled={isActing}
              className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {isActing ? "…" : "Save & Approve"}
            </button>
            <button
              onClick={onSaveEdits}
              disabled={isActing}
              className="rounded-md border border-navy/20 px-4 py-1.5 text-xs text-navy/60 hover:border-navy/40 transition"
            >
              Save only
            </button>
            <button
              onClick={onEditClose}
              className="rounded-md px-3 py-1.5 text-xs text-navy/40 hover:text-navy/60 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RejectButton({ onReject }: { onReject: (reason: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [reason, setReason] = useState("manual_reject");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50 transition"
      >
        Reject
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        className="rounded border border-navy/20 px-2 py-1 text-xs w-36 focus:outline-none focus:border-navy/40"
        value={reason}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
        placeholder="reject reason"
      />
      <button
        onClick={() => { onReject(reason); setOpen(false); }}
        className="rounded-md bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
      >✓</button>
      <button onClick={() => setOpen(false)} className="text-xs text-navy/30 hover:text-navy/60 px-1">✕</button>
    </div>
  );
}

function MedianBadge({
  warning, ratio, median,
}: {
  warning: "low" | "high";
  ratio:   number | null | undefined;
  median:  number | null | undefined;
}) {
  const isLow = warning === "low";
  return (
    <span
      title={`Median: ¥${median?.toLocaleString() ?? "?"} | Ratio: ${ratio?.toFixed(2) ?? "?"}x`}
      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        isLow ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
      }`}
    >
      {isLow ? "▼ Low" : "▲ High"}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const dot: Record<string, string> = {
    pending:  "bg-amber-400",
    imported: "bg-green-500",
    filtered: "bg-red-400",
    duplicate:"bg-purple-400",
    error:    "bg-red-600",
  };
  const label: Record<string, string> = {
    pending:  "Pending",
    imported: "Imported",
    filtered: "Filtered",
    duplicate:"Duplicate",
    error:    "Error",
  };
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span className={`h-2 w-2 rounded-full ${dot[status] ?? "bg-navy/20"}`} />
      <span className="text-[10px] uppercase tracking-wide text-navy/50 w-14">{label[status] ?? status}</span>
    </span>
  );
}

function EditField({
  label, value, onChange, type = "text",
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  type?:    string;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] uppercase tracking-widest text-navy/40">{label}</label>
      <input
        type={type}
        className="w-full rounded border border-navy/20 bg-white px-2 py-1 text-xs text-navy focus:border-navy/40 focus:outline-none"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </div>
  );
}

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

// ── FilterCategoryBadge ───────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  graded:    { label: "鑑定品",   className: "bg-purple-100 text-purple-700" },
  bundle:    { label: "まとめ",   className: "bg-orange-100 text-orange-700" },
  fake:      { label: "偽物/非売品", className: "bg-red-100 text-red-700"   },
  accessory: { label: "付属品のみ", className: "bg-slate-100 text-slate-600" },
  damage:    { label: "破損",     className: "bg-amber-100 text-amber-700"  },
  price:     { label: "価格範囲外", className: "bg-sky-100 text-sky-700"    },
  ng_word:   { label: "NGワード", className: "bg-gray-100 text-gray-600"   },
};

function FilterCategoryBadge({ reason }: { reason: string }) {
  // Extract category from reason string — format is "category: ..."
  const category = reason.split(":")[0].trim();
  const style = CATEGORY_STYLES[category] ?? { label: category, className: "bg-navy/10 text-navy/50" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}>
      {style.label}
    </span>
  );
}
