import { getDistributionLogs, type DistributionLogRow } from "@gci/core";

export const dynamic = "force-dynamic";

export default async function AdminDistributionPage() {
  const logs = await getDistributionLogs(60);

  const totalPostedX        = logs.filter((l) => l.tweetId).length;
  const totalPostedXNoon    = logs.filter((l) => l.noonTweetId).length;
  const totalPostedXEvening = logs.filter((l) => l.eveningTweetId).length;
  const totalPostedDiscord  = logs.filter((l) => l.discordMessageId).length;
  const totalDays           = logs.length;

  return (
    <div className="space-y-10">
      <header className="border-b border-navy/10 pb-6">
        <p className="text-xs uppercase tracking-widest text-navy/40">Admin</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">Distribution Logs</h1>
        <p className="mt-1 text-sm text-navy/50">
          X / Discord / RSS の配信状況を日次で確認します。
        </p>
      </header>

      {/* ── サマリーカード ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <StatCard label="Snapshots"      value={totalDays.toString()}            />
          <StatCard label="X 朝"    value={`${totalPostedX} / ${totalDays}`}
            highlight={totalPostedX === totalDays ? "green" : totalPostedX > 0 ? "amber" : "red"}
          />
          <StatCard label="X 昼"    value={`${totalPostedXNoon} / ${totalDays}`}
            highlight={totalPostedXNoon === totalDays ? "green" : totalPostedXNoon > 0 ? "amber" : "red"}
          />
          <StatCard label="X 夜"    value={`${totalPostedXEvening} / ${totalDays}`}
            highlight={totalPostedXEvening === totalDays ? "green" : totalPostedXEvening > 0 ? "amber" : "red"}
          />
          <StatCard label="Discord"        value={`${totalPostedDiscord} / ${totalDays}`}
            highlight={totalPostedDiscord === totalDays ? "green" : totalPostedDiscord > 0 ? "amber" : "red"}
          />
          <StatCard label="RSS"            value={`${totalDays} / ${totalDays}`}   highlight="green" />
        </div>
      </section>

      {/* ── チャンネル凡例 ── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Channels</h2>
        <div className="flex flex-wrap gap-4 text-xs text-navy/60">
          <ChannelLegend icon="𝕏" label="X 朝 — Today's Market"
            desc="毎朝 08:05 JST — /api/v1/cron/daily-post" />
          <ChannelLegend icon="𝕏" label="X 昼 — 今日の急騰カード"
            desc="毎日 12:30 JST — /api/v1/cron/x-noon" />
          <ChannelLegend icon="𝕏" label="X 夜 — 今日の価格更新"
            desc="毎日 20:30 JST — /api/v1/cron/x-evening" />
          <ChannelLegend icon="🎮" label="Discord"
            desc="毎朝 02:00 JST — /api/v1/cron/daily-discord" />
          <ChannelLegend icon="📡" label="RSS"
            desc="常時 — /feed.xml (30件キャッシュ)" />
        </div>
      </section>

      {/* ── ログテーブル ── */}
      <section>
        <h2 className="mb-4 text-xs uppercase tracking-widest text-navy/40">
          Log — last {totalDays} days
        </h2>

        {logs.length === 0 ? (
          <p className="border border-navy/10 bg-white p-6 text-sm text-navy/40">
            まだスナップショットがありません。daily-snapshot cron を実行してください。
          </p>
        ) : (
          <div className="overflow-x-auto border border-navy/10 bg-white">
            <table className="min-w-full divide-y divide-navy/10 text-sm">
              <thead className="bg-navy/5 text-left text-xs uppercase tracking-widest text-navy/50">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">RSS</th>
                  <th className="px-4 py-3">X 朝</th>
                  <th className="px-4 py-3">X 昼</th>
                  <th className="px-4 py-3">X 夜</th>
                  <th className="px-4 py-3">Discord</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {logs.map((row) => (
                  <DistributionRow key={row.date} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 手動再送ガイド ── */}
      <section className="border border-navy/10 bg-navy/[0.02] p-6">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-navy/40">Manual retrigger</h2>
        <p className="mb-4 text-xs text-navy/50">
          各チャンネルの再送は以下の cron エンドポイントに
          <code className="mx-1 rounded bg-navy/5 px-1 font-mono">Authorization: Bearer $CRON_SECRET</code>
          ヘッダーを付けて curl します。
        </p>
        <div className="space-y-2 font-mono text-[11px] text-navy/60">
          <p>
            <span className="mr-2 text-navy/30"># Dry-run（テキスト確認）</span>
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-post?date=YYYY-MM-DD&amp;dry=1&quot;
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/x-noon?date=YYYY-MM-DD&amp;dry=1&quot;
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/x-evening?date=YYYY-MM-DD&amp;dry=1&quot;
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-discord?date=YYYY-MM-DD&amp;dry=1&quot;
          </p>
          <p>
            <span className="mr-2 text-navy/30"># 実際に再送（既投稿を上書き）</span>
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-post?date=YYYY-MM-DD&amp;force=1&quot;
          </p>
          <p className="rounded bg-navy/5 px-3 py-2">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; \<br />
            &nbsp;&nbsp;&quot;/api/v1/cron/daily-discord?date=YYYY-MM-DD&amp;force=1&quot;
          </p>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------
// Row
// ----------------------------------------------------------------

function DistributionRow({ row }: { row: DistributionLogRow }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://gci-index.com";

  return (
    <tr className="hover:bg-navy/[0.02]">
      {/* Date */}
      <td className="px-4 py-3 font-medium tabular-nums text-navy">
        <a
          href={`${baseUrl}/daily/${row.date}`}
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {row.date}
        </a>
      </td>

      {/* Generated at */}
      <td className="px-4 py-3 text-xs text-navy/50 tabular-nums">
        {fmtDatetime(row.generatedAt)}
      </td>

      {/* RSS — always available once snapshot exists */}
      <td className="px-4 py-3">
        <PostedBadge
          posted={true}
          label="Posted"
          href={`${baseUrl}/feed.xml`}
          title="/feed.xml"
        />
      </td>

      {/* X 朝 */}
      <td className="px-4 py-3">
        {row.tweetId ? (
          <PostedBadge
            posted={true}
            label="Posted"
            href={row.tweetUrl ?? undefined}
            sublabel={fmtDatetime(row.tweetedAt)}
            title={`Tweet ID: ${row.tweetId}`}
          />
        ) : (
          <NotPostedBadge channel="x" date={row.date} />
        )}
      </td>

      {/* X 昼 */}
      <td className="px-4 py-3">
        {row.noonTweetId ? (
          <PostedBadge
            posted={true}
            label="Posted"
            href={row.noonTweetUrl ?? undefined}
            sublabel={fmtDatetime(row.noonTweetedAt)}
            title={`Tweet ID: ${row.noonTweetId}`}
          />
        ) : (
          <NotPostedBadge channel="x-noon" date={row.date} />
        )}
      </td>

      {/* X 夜 */}
      <td className="px-4 py-3">
        {row.eveningTweetId ? (
          <PostedBadge
            posted={true}
            label="Posted"
            href={row.eveningTweetUrl ?? undefined}
            sublabel={fmtDatetime(row.eveningTweetedAt)}
            title={`Tweet ID: ${row.eveningTweetId}`}
          />
        ) : (
          <NotPostedBadge channel="x-evening" date={row.date} />
        )}
      </td>

      {/* Discord */}
      <td className="px-4 py-3">
        {row.discordMessageId ? (
          <PostedBadge
            posted={true}
            label="Posted"
            sublabel={fmtDatetime(row.discordPostedAt)}
            title={`Message ID: ${row.discordMessageId}`}
          />
        ) : (
          <NotPostedBadge channel="discord" date={row.date} />
        )}
      </td>

      {/* Actions — 手動再送へのリンク */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <RetriggerLink channel="x"         date={row.date} />
          <RetriggerLink channel="x-noon"    date={row.date} />
          <RetriggerLink channel="x-evening" date={row.date} />
          <RetriggerLink channel="discord"   date={row.date} />
        </div>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------
// Sub components
// ----------------------------------------------------------------

type Highlight = "green" | "amber" | "red" | "neutral";

function StatCard({
  label,
  value,
  highlight = "neutral",
}: {
  label:      string;
  value:      string;
  highlight?: Highlight;
}) {
  const colors: Record<Highlight, string> = {
    green:   "text-gold-700",
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
    </div>
  );
}

function ChannelLegend({
  icon,
  label,
  desc,
}: {
  icon:  string;
  label: string;
  desc:  string;
}) {
  return (
    <div className="flex items-start gap-2 border border-navy/10 bg-white px-4 py-3">
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <div>
        <p className="font-medium text-navy">{label}</p>
        <p className="mt-0.5 text-[11px] font-mono text-navy/40">{desc}</p>
      </div>
    </div>
  );
}

function PostedBadge({
  posted,
  label,
  href,
  sublabel,
  title,
}: {
  posted:     boolean;
  label:      string;
  href?:      string;
  sublabel?:  string | null;
  title?:     string;
}) {
  const badge = (
    <span
      className="inline-block rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-700"
      title={title}
    >
      ✓ {label}
    </span>
  );

  return (
    <div className="space-y-0.5">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
          {badge}
        </a>
      ) : badge}
      {sublabel && (
        <p className="text-[10px] tabular-nums text-navy/35">{sublabel}</p>
      )}
    </div>
  );
}

type DistChannel = "x" | "x-noon" | "x-evening" | "discord";

function NotPostedBadge({
  channel: _channel,
  date:    _date,
}: {
  channel: DistChannel;
  date:    string;
}) {
  return (
    <div className="space-y-0.5">
      <span className="inline-block rounded-sm bg-navy/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-navy/35">
        — Not posted
      </span>
    </div>
  );
}

const CHANNEL_LABEL: Record<DistChannel, string> = {
  "x":         "X 朝",
  "x-noon":    "X 昼",
  "x-evening": "X 夜",
  "discord":   "Discord",
};

/** 手動再送ボタン — /admin/api/retrigger プロキシ経由で CRON_SECRET を付与 */
function RetriggerLink({
  channel,
  date,
}: {
  channel: DistChannel;
  date:    string;
}) {
  const dryUrl   = `/admin/api/retrigger?channel=${channel}&date=${date}`;
  const forceUrl = `/admin/api/retrigger?channel=${channel}&date=${date}&force=1`;
  const icon     = channel === "discord" ? "🎮" : "𝕏";
  const label    = CHANNEL_LABEL[channel];

  return (
    <div className="flex gap-1">
      <a
        href={dryUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Dry-run ${label} for ${date}`}
        className="inline-flex items-center gap-1 rounded border border-navy/15 px-2 py-1 text-[10px] text-navy/50 transition hover:border-navy/30 hover:text-navy/70"
      >
        {icon} dry
      </a>
      <a
        href={forceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`本番投稿 ${label} for ${date}（クリックで即投稿）`}
        className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[10px] text-red-400 transition hover:border-red-400 hover:text-red-600"
      >
        {icon} post
      </a>
    </div>
  );
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
