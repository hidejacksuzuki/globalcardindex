import {
  getSubscriberStats,
  getRecentSubscribers,
  getNewsletterRunLogs,
  type SubscriberRow,
  type NewsletterRunLogRow,
} from "@gci/core";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const [stats, subscribers, runLogs] = await Promise.all([
    getSubscriberStats(),
    getRecentSubscribers(30),
    getNewsletterRunLogs(10),
  ]);

  const lastRun = runLogs[0] ?? null;

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Newsletter</h1>
        <p className="mt-1 text-sm text-navy/50">
          購読者管理・配信ログ・メール reputation 監視。
        </p>
      </header>

      {/* ── ステータスバナー ── */}
      <SendStatusBanner lastRun={lastRun} />

      {/* ── 購読者サマリー ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Subscribers</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total"        value={stats.total.toLocaleString()}        />
          <StatCard label="Confirmed"    value={stats.active.toLocaleString()}
            highlight={stats.active > 0 ? "green" : "neutral"}
            sub="active"
          />
          <StatCard label="Pending"      value={stats.pending.toLocaleString()}
            highlight={stats.pending > 20 ? "amber" : "neutral"}
            sub="未確認"
          />
          <StatCard label="Unsubscribed" value={stats.unsubscribed.toLocaleString()}
            highlight="neutral"
            sub="退会済み"
          />
          <StatCard label="Bounced"      value={stats.bounced.toLocaleString()}
            highlight={stats.bounced > 0 ? "red" : "neutral"}
            sub="要確認"
          />
        </div>
      </section>

      {/* ── 購読率バー ── */}
      {stats.total > 0 && (
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Breakdown</h2>
          <div className="flex h-4 w-full overflow-hidden rounded-sm">
            {stats.active > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(stats.active / stats.total) * 100}%` }}
                title={`Confirmed: ${stats.active}`}
              />
            )}
            {stats.pending > 0 && (
              <div
                className="bg-amber-300 transition-all"
                style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                title={`Pending: ${stats.pending}`}
              />
            )}
            {stats.unsubscribed > 0 && (
              <div
                className="bg-navy/15 transition-all"
                style={{ width: `${(stats.unsubscribed / stats.total) * 100}%` }}
                title={`Unsubscribed: ${stats.unsubscribed}`}
              />
            )}
            {stats.bounced > 0 && (
              <div
                className="bg-red-400 transition-all"
                style={{ width: `${(stats.bounced / stats.total) * 100}%` }}
                title={`Bounced: ${stats.bounced}`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-navy/50">
            <span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500 mr-1" />Confirmed</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-300 mr-1" />Pending</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-navy/15 mr-1" />Unsubscribed</span>
            <span><span className="inline-block h-2 w-2 rounded-sm bg-red-400 mr-1" />Bounced</span>
          </div>
        </section>
      )}

      {/* ── 配信実行ログ ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Run Log — last {runLogs.length > 0 ? runLogs.length : "0"} entries
        </h2>
        {runLogs.length === 0 ? (
          <EmptyState message="まだ実行ログがありません。daily-newsletter cron を dry-run してください。" />
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Sent</th>
                  <th className="px-4 py-3 text-right">Errors</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Triggered</th>
                  <th className="px-4 py-3">At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {runLogs.map((log) => (
                  <RunLogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 最新購読者テーブル ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Recent Subscribers — last {subscribers.length}
        </h2>
        {subscribers.length === 0 ? (
          <EmptyState message="まだ購読者がいません。/newsletter から登録テストをしてください。" />
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Confirmed</th>
                  <th className="px-4 py-3">Bounce</th>
                  <th className="px-4 py-3">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {subscribers.map((sub) => (
                  <SubscriberTableRow key={sub.id} sub={sub} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 実配信チェックリスト ── */}
      <section className="border border-navy/10 bg-navy/[0.02] p-6">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">
          実配信 有効化チェックリスト
        </h2>
        <div className="space-y-2 text-sm">
          <CheckItem
            done={stats.active > 0}
            label={`購読者が 1 名以上 active（現在: ${stats.active} 名）`}
          />
          <CheckItem
            done={stats.bounced === 0}
            label={`Bounce 件数ゼロ（現在: ${stats.bounced} 件）`}
          />
          <CheckItem
            done={lastRun !== null}
            label="dry-run が 1 回以上成功している"
          />
          <CheckItem
            done={false}
            label="bounce webhook が設定・テスト済み（次ステップ）"
          />
          <CheckItem
            done={false}
            label="RESEND_API_KEY が本番環境に設定済み"
          />
          <CheckItem
            done={false}
            label="SEND_ENABLED = true に変更（最後に実行）"
          />
        </div>

        <div className="mt-6 font-mono text-[11px] text-navy/50 space-y-2">
          <p className="text-navy/30"># dry-run 実行（管理画面に記録される）</p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br/>
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-newsletter?dry=1&amp;trigger=manual&quot;
          </p>
          <p className="text-navy/30"># 先頭 1 件のメール内容確認</p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br/>
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-newsletter?preview=1&quot;
          </p>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

function SendStatusBanner({ lastRun }: { lastRun: NewsletterRunLogRow | null }) {
  if (!lastRun) {
    return (
      <div className="border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <span className="font-medium">⚠️ dry-run 未実行</span>
        <span className="ml-2 text-amber-600">
          実配信を有効化する前に dry-run を 1 回以上実行してください。
        </span>
      </div>
    );
  }

  const isLive   = lastRun.mode === "live";
  const isRecent = Date.now() - new Date(lastRun.createdAt).getTime() < 86400_000;

  if (isLive && lastRun.status === "ok") {
    return (
      <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        <span className="font-medium">✅ 最終配信 OK</span>
        <span className="ml-2 text-emerald-600">
          {lastRun.date} — {lastRun.totalSent} 件送信 · {fmtDatetime(lastRun.createdAt)}
        </span>
      </div>
    );
  }

  if (isLive && lastRun.status === "error") {
    return (
      <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        <span className="font-medium">❌ 最終配信 エラー</span>
        <span className="ml-2 text-red-600">
          {lastRun.date} — {lastRun.note ?? "不明なエラー"}
        </span>
      </div>
    );
  }

  return (
    <div className={[
      "border px-5 py-4 text-sm",
      isRecent
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : "border-navy/10 bg-white text-navy/60",
    ].join(" ")}>
      <span className="font-medium">
        {isRecent ? "🔍 " : ""}Dry-run モード
      </span>
      <span className="ml-2">
        最終実行: {lastRun.date} — 対象 {lastRun.totalTarget} 名 · {fmtDatetime(lastRun.createdAt)}
      </span>
      <span className="ml-2 text-[11px] text-navy/40">
        （実配信なし）
      </span>
    </div>
  );
}

type Highlight = "green" | "amber" | "red" | "neutral";

function StatCard({
  label,
  value,
  highlight = "neutral",
  sub,
}: {
  label:      string;
  value:      string;
  highlight?: Highlight;
  sub?:       string;
}) {
  const colors: Record<Highlight, string> = {
    green:   "text-emerald-600",
    amber:   "text-amber-600",
    red:     "text-red-600",
    neutral: "text-navy",
  };
  return (
    <div className="border border-navy/10 bg-white p-4">
      <p className="text-[10px] uppercase tracking-widest text-navy/40">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${colors[highlight]}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-navy/30">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:       "bg-emerald-50 text-emerald-700",
    pending:      "bg-amber-50 text-amber-700",
    unsubscribed: "bg-navy/5 text-navy/40",
    bounced:      "bg-red-50 text-red-700",
  };
  const style = styles[status] ?? "bg-navy/5 text-navy/50";
  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${style}`}>
      {status}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok:      "bg-emerald-50 text-emerald-700",
    error:   "bg-red-50 text-red-600",
    skipped: "bg-navy/5 text-navy/40",
  };
  const icons: Record<string, string> = { ok: "✓", error: "✗", skipped: "—" };
  const style = styles[status] ?? "bg-navy/5 text-navy/50";
  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${style}`}>
      {icons[status] ?? ""} {status}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    dry:     "bg-sky-50 text-sky-700",
    preview: "bg-violet-50 text-violet-700",
    live:    "bg-emerald-50 text-emerald-700",
  };
  const style = styles[mode] ?? "bg-navy/5 text-navy/50";
  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-medium ${style}`}>
      {mode}
    </span>
  );
}

function RunLogRow({ log }: { log: NewsletterRunLogRow }) {
  return (
    <tr className="hover:bg-navy/[0.02]">
      <td className="px-4 py-3 tabular-nums font-medium text-navy">{log.date}</td>
      <td className="px-4 py-3"><ModeBadge mode={log.mode} /></td>
      <td className="px-4 py-3"><RunStatusBadge status={log.status} /></td>
      <td className="px-4 py-3 text-right tabular-nums">{log.totalTarget}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {log.totalSent > 0
          ? <span className="text-emerald-600 font-medium">{log.totalSent}</span>
          : <span className="text-navy/25">0</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {log.errorCount > 0
          ? <span className="text-red-600 font-medium">{log.errorCount}</span>
          : <span className="text-navy/25">—</span>}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-navy/50 text-xs">
        {log.durationMs != null ? `${log.durationMs}ms` : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-navy/40 font-mono max-w-[160px] truncate" title={log.note ?? ""}>
        {log.note ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-navy/40">{log.triggeredBy}</td>
      <td className="px-4 py-3 text-xs text-navy/40 tabular-nums whitespace-nowrap">
        {fmtDatetime(log.createdAt)}
      </td>
    </tr>
  );
}

function SubscriberTableRow({ sub }: { sub: SubscriberRow }) {
  // メールアドレスの一部をマスク: user@example.com → us**@example.com
  const maskedEmail = maskEmail(sub.email);

  return (
    <tr className="hover:bg-navy/[0.02]">
      <td className="px-4 py-3 font-mono text-xs text-navy" title={sub.email}>
        {maskedEmail}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={sub.status} />
      </td>
      <td className="px-4 py-3 text-xs text-navy/50">
        {sub.source ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-navy/50 tabular-nums whitespace-nowrap">
        {sub.confirmedAt ? fmtDatetime(sub.confirmedAt) : (
          <span className="text-navy/25">未確認</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {sub.bouncedAt ? (
          <span className="text-red-600 font-medium" title={sub.bounceType ?? ""}>
            {sub.bounceType ?? "bounce"} — {fmtDatetime(sub.bouncedAt)}
          </span>
        ) : (
          <span className="text-navy/20">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-navy/40 tabular-nums whitespace-nowrap">
        {fmtDatetime(sub.createdAt)}
      </td>
    </tr>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 text-base leading-none ${done ? "text-emerald-500" : "text-navy/20"}`}>
        {done ? "✓" : "○"}
      </span>
      <span className={done ? "text-navy/70" : "text-navy/40"}>
        {label}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
      {message}
    </p>
  );
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** メールアドレスの先頭 2 文字以外をアスタリスクでマスク（プライバシー配慮） */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  const masked = local.slice(0, 2) + "*".repeat(Math.min(local.length - 2, 4));
  return `${masked}@${domain}`;
}
