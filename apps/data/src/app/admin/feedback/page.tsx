import {
  getBetaFeedbackList,
  type BetaFeedbackType,
  type BetaFeedbackStatus,
} from "@gci/core";
import { FeedbackStatusSelect } from "@/components/feedback/FeedbackStatusSelect";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<BetaFeedbackType, string> = {
  bug:              "不具合報告",
  request_card:     "カードリクエスト",
  feature_request:  "機能要望",
  other:            "その他",
};

const TYPE_BADGE: Record<BetaFeedbackType, string> = {
  bug:              "bg-red-50 text-red-700 border-red-200",
  request_card:     "bg-blue-50 text-blue-700 border-blue-200",
  feature_request:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  other:            "bg-slate-50 text-slate-600 border-slate-200",
};

function isValidType(v: string | undefined): v is BetaFeedbackType {
  return v === "bug" || v === "request_card" || v === "feature_request" || v === "other";
}

function isValidStatus(v: string | undefined): v is BetaFeedbackStatus {
  return v === "open" || v === "reviewed" || v === "closed";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

type SearchParams = { type?: string; status?: string; q?: string };

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const type   = isValidType(searchParams.type) ? searchParams.type : undefined;
  const status = isValidStatus(searchParams.status) ? searchParams.status : undefined;
  const search = searchParams.q || undefined;

  const items = await getBetaFeedbackList({ type, status, search });
  const openCount = items.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-navy">Beta Feedback</h1>
        <p className="mt-1 text-sm text-navy/50">
          β公開時のユーザーフィードバック一覧（{items.length}件 / Open: {openCount}件）
        </p>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <form className="flex flex-wrap items-end gap-3 border border-navy/10 bg-white p-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">検索</label>
          <input
            type="text"
            name="q"
            defaultValue={search ?? ""}
            placeholder="メッセージ・カード名"
            className="border border-navy/15 px-3 py-1.5 text-sm outline-none focus:border-navy/50 transition w-56"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">種類</label>
          <select name="type" defaultValue={type ?? ""} className="border border-navy/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-navy/50 transition">
            <option value="">すべて</option>
            {(Object.keys(TYPE_LABEL) as BetaFeedbackType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-navy/40 mb-1">ステータス</label>
          <select name="status" defaultValue={status ?? ""} className="border border-navy/15 px-3 py-1.5 text-sm bg-white outline-none focus:border-navy/50 transition">
            <option value="">すべて</option>
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button type="submit" className="border border-navy bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy/80 transition">
          適用
        </button>
      </form>

      {/* ── List ───────────────────────────────────────────────── */}
      <div className="border border-navy/10 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-navy/5 bg-navy/[0.02]">
              {["種類", "内容", "カード名", "送信ページ", "ユーザー", "ステータス", "受信日時"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-navy/40 font-normal whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-navy/30">
                  該当するフィードバックがありません。
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-navy/[0.015] transition align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block border rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE[item.type]}`}>
                      {TYPE_LABEL[item.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <p className="text-navy/80 whitespace-pre-wrap break-words">{item.message}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/50 whitespace-nowrap">{item.cardName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-navy/40 whitespace-nowrap max-w-[160px] truncate">{item.currentPath ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-navy/40 whitespace-nowrap">
                    {item.userId ? "ログイン済み" : "匿名"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <FeedbackStatusSelect id={item.id} status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-navy/40 whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
