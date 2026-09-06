import { redirect, notFound } from 'next/navigation';
import { auth } from '@/auth';
import { GAMES, getGameIndex, getMarketboard, type GameIndexResult, type MarketboardRow } from '@gci/core';
import { CopyButton } from '@/components/admin/CopyButton';

/**
 * /admin/daily-post — X 毎日投稿の運用支援ページ（管理用）
 *
 * ゲームごとに「ポスト文面（コピー・文字数カウント付き）」「添付用画像」
 * 「X の投稿画面を開くリンク」を並べる。毎朝ここを開いてコピー→画像保存→
 * ポスト、の3ステップで運用する想定。
 *
 * アクセス制御: ログイン必須。ADMIN_EMAILS（カンマ区切り）が設定されていれば
 * そのメールのみ許可。開発環境では認証をスキップして動作確認できるようにする。
 * middleware はロケールリライトを /admin/ でバイパスする。
 */

export const dynamic = 'force-dynamic';

const SITE_ORIGIN = 'https://www.gci-index.com';

// X 投稿用の短いゲーム名とハッシュタグ（運用専用なので core には置かない）
const X_META: Record<string, { label: string; tags: string }> = {
  pokemon:  { label: 'ポケカ',     tags: '#ポケカ #ポケカ高騰' },
  onepiece: { label: 'ワンピカード', tags: '#ワンピカード #ワンピースカード' },
  yugioh:   { label: '遊戯王',     tags: '#遊戯王 #遊戯王高騰' },
  mtg:      { label: 'MTG',        tags: '#MTG #マジックザギャザリング' },
};

const fmtPct = (v: number | null): string =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

function buildPostText(
  slug: string,
  gameLabel: string,
  tags: string,
  idx: GameIndexResult | null,
  gainers: MarketboardRow[],
  dateLabel: string,
): string {
  const lines: string[] = [];
  lines.push(`【${gameLabel}相場 ${dateLabel}】`);
  if (idx && idx.value !== null) {
    lines.push(`GCI${gameLabel}指数 ${idx.value.toFixed(1)}（前日${fmtPct(idx.change24h)} / 30日${fmtPct(idx.change30d)}）`);
  }
  if (gainers.length > 0) {
    lines.push('');
    lines.push('📈急騰(30日)');
    for (const g of gainers) {
      lines.push(`${g.name} ${fmtPct(g.changeRate)}`);
    }
  }
  lines.push('');
  lines.push('全カードの相場・推移👇');
  lines.push(`${SITE_ORIGIN}/games/${slug}`);
  lines.push('');
  lines.push(tags);
  return lines.join('\n');
}

export default async function DailyPostAdminPage() {
  // ── アクセス制御 ─────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    const session = await auth().catch(() => null);
    const email = session?.user?.email ?? null;
    if (!email) redirect('/login?callbackUrl=/admin/daily-post');
    const allow = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length > 0 && !allow.includes(email)) notFound();
  }

  // ── データ取得（非表示ゲームは対象外） ───────────────────────
  const games = GAMES.filter((g) => !g.hidden);
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date());

  const sections = await Promise.all(
    games.map(async (game) => {
      const [idx, rows] = await Promise.all([
        getGameIndex(game.slug).catch(() => null),
        getMarketboard({ game: game.slug }).catch(() => [] as MarketboardRow[]),
      ]);
      // 発信用: データ点数の少ないカードは価格が乱高下しやすいので除外
      const gainers = rows
        .filter((r) => r.changeRate !== null && r.changeRate > 0 && r.latestPrice !== null && r.dataPoints >= 3)
        .sort((a, b) => b.changeRate! - a.changeRate!)
        .slice(0, 3);
      const meta = X_META[game.slug] ?? { label: game.nameJa, tags: '' };
      const text = buildPostText(game.slug, meta.label, meta.tags, idx, gainers, dateLabel);
      return { game, idx, gainers, text };
    }),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-navy/10 bg-white px-6 py-4">
        <p className="text-xs uppercase tracking-widest text-navy/40">GCI Admin</p>
        <h1 className="mt-0.5 text-xl font-semibold text-navy">X 毎日投稿（{dateLabel}）</h1>
        <p className="mt-1 text-xs text-navy/50">
          ①文面をコピー → ②画像を保存（右クリック / 長押し） → ③「Xで投稿画面を開く」で貼り付け、画像を添付してポスト。
        </p>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        {sections.map(({ game, idx, text }) => (
          <section key={game.slug} className="border border-navy/10 bg-white">
            <div className="flex items-center justify-between border-b border-navy/5 px-5 py-3">
              <p className="text-sm font-semibold text-navy">
                {game.emoji} {game.nameJa}
                {idx && idx.value !== null && (
                  <span className={`ml-3 tabular-nums ${game.color}`}>{idx.value.toFixed(1)}</span>
                )}
              </p>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black text-white px-3 py-1.5 text-xs font-semibold rounded-sm hover:bg-black/80 transition"
              >
                𝕏 Xで投稿画面を開く
              </a>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-2">
              {/* 文面 */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-navy/40">ポスト文面</p>
                <pre className="whitespace-pre-wrap border border-navy/10 bg-slate-50 p-4 text-sm leading-relaxed text-navy">
                  {text}
                </pre>
                <CopyButton text={text} />
              </div>

              {/* 添付画像 */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-navy/40">
                  添付画像（右クリック / 長押しで保存）
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/admin/daily-post/image?game=${game.slug}`}
                  alt={`${game.nameJa} の本日の相場画像`}
                  className="w-full border border-navy/10"
                />
              </div>
            </div>
          </section>
        ))}

        <p className="pb-8 text-center text-[11px] text-navy/30">
          データはゲームハブと同じ算出（30日窓・外れ値/stale除外）。画像は開くたびに最新データで生成されます。
        </p>
      </main>
    </div>
  );
}
