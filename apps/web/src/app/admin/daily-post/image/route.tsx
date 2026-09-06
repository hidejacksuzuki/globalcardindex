/**
 * /admin/daily-post/image?game=pokemon — X 投稿添付用の画像（1200×675, 16:9）
 *
 * その日のゲーム別指数と急騰 Top3 を1枚にまとめる。管理ページから
 * 右クリック保存して X に添付する運用。ページ側と同じくログイン必須
 * （開発環境はスキップ）。
 */

import { ImageResponse } from 'next/og';
import { auth } from '@/auth';
import { getGame, getGameIndex, getMarketboard, formatPrice, type MarketboardRow } from '@gci/core';
import { loadNotoSansJP } from '@/lib/og/fonts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 675;

const WHITE  = '#ffffff';
const MUTED  = 'rgba(255,255,255,0.45)';
const GOLD   = '#d4af37';
const GREEN  = '#4ade80';
const RED    = '#f87171';
const BORDER = 'rgba(255,255,255,0.12)';

// ゲームごとの背景グラデーションとアクセント色
const THEME: Record<string, { bg: [string, string]; accent: string }> = {
  pokemon:  { bg: ['#0f2040', '#1a3560'], accent: '#facc15' },
  onepiece: { bg: ['#1a0a0a', '#3d1010'], accent: '#f87171' },
  yugioh:   { bg: ['#120f20', '#251a40'], accent: '#c084fc' },
  mtg:      { bg: ['#0a1020', '#0f2040'], accent: '#60a5fa' },
};

const pct = (v: number | null) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    const session = await auth().catch(() => null);
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('game') ?? 'pokemon';
  const game = getGame(slug);
  if (!game) return new Response('Unknown game', { status: 404 });

  const [idx, rows, fontData] = await Promise.all([
    getGameIndex(slug).catch(() => null),
    getMarketboard({ game: slug }).catch(() => [] as MarketboardRow[]),
    loadNotoSansJP(),
  ]);
  // 発信用: データ点数の少ないカードは価格が乱高下しやすいので除外（ページ側と同条件）
  const gainers = rows
    .filter((r) => r.changeRate !== null && r.changeRate > 0 && r.latestPrice !== null && r.dataPoints >= 3)
    .sort((a, b) => b.changeRate! - a.changeRate!)
    .slice(0, 3);

  const theme = THEME[slug] ?? THEME.pokemon;
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date());

  const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'] = fontData
    ? [{ name: 'Noto Sans JP', data: fontData, style: 'normal' }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${theme.bg[0]} 0%, ${theme.bg[1]} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Noto Sans JP, sans-serif',
          padding: '48px 64px',
          position: 'relative',
        }}
      >
        {/* 背景の大絵文字 */}
        <div style={{ position: 'absolute', right: 40, bottom: 0, fontSize: 260, opacity: 0.07, display: 'flex' }}>
          {game.emoji}
        </div>

        {/* ヘッダー行 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: MUTED }}>
            Global Card Index
          </span>
          <span style={{ fontSize: 18, color: MUTED }}>{dateLabel}</span>
        </div>

        {/* ゲーム名＋指数 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 30 }}>
          <span style={{ fontSize: 52 }}>{game.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 26, color: MUTED }}>{game.nameJa} 指数</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
              <span style={{ fontSize: 84, fontWeight: 700, color: theme.accent, lineHeight: 1.1 }}>
                {idx && idx.value !== null ? idx.value.toFixed(1) : '—'}
              </span>
              {idx && (
                <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 10, gap: 2 }}>
                  <span style={{ fontSize: 22, color: (idx.change24h ?? 0) >= 0 ? GREEN : RED }}>
                    前日 {pct(idx.change24h)}
                  </span>
                  <span style={{ fontSize: 22, color: (idx.change30d ?? 0) >= 0 ? GREEN : RED }}>
                    30日 {pct(idx.change30d)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 急騰 Top3 */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34, borderTop: `1px solid ${BORDER}`, paddingTop: 22, gap: 12 }}>
          <span style={{ fontSize: 18, letterSpacing: 2, color: MUTED }}>📈 急騰カード（30日）</span>
          {gainers.map((g, i) => (
            <div key={g.cardId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 24, color: MUTED, width: 30, display: 'flex' }}>{i + 1}</span>
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: WHITE,
                  maxWidth: 560,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                }}
              >
                {g.name}
              </span>
              <span style={{ fontSize: 22, color: MUTED, maxWidth: 220, overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex' }}>
                {g.setName}
              </span>
              <span style={{ fontSize: 28, fontWeight: 700, color: GREEN, marginLeft: 'auto', display: 'flex' }}>
                {pct(g.changeRate)}
              </span>
              <span style={{ fontSize: 24, color: GOLD, width: 190, justifyContent: 'flex-end', display: 'flex' }}>
                {g.latestPrice !== null && g.currency ? formatPrice(g.latestPrice, g.currency) : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, color: MUTED }}>実売データから毎日更新 · 外れ値除外済み</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: WHITE }}>gci-index.com</span>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
