/**
 * /games/[slug]/opengraph-image.tsx
 *
 * ゲーム別市場指数ページ用 OG 画像。
 * 1200 × 630 px。"市場感" を前面に出したデザイン。
 */

import { ImageResponse }  from "next/og";
import { getGame, getGameSlugs } from "@/lib/seo/games";
import { getGameStats }   from "@/actions/seo";
import { loadNotoSansJP } from "@/lib/og/fonts";
import { formatPrice }    from "@/lib/utils/formatPrice";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const alt         = "Game market index on Global Card Index";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

// ゲームごとのグラデーション背景
const GAME_GRADIENTS: Record<string, [string, string]> = {
  pokemon:  ["#0f2040", "#1a3560"],
  onepiece: ["#1a0a0a", "#3d1010"],
  yugioh:   ["#120f20", "#251a40"],
  mtg:      ["#0a1020", "#0f2040"],
};
const DEFAULT_GRADIENT: [string, string] = ["#0f2040", "#1a3560"];

const WHITE  = "#ffffff";
const MUTED  = "rgba(255,255,255,0.45)";
const GOLD   = "#b8912a";
const BORDER = "rgba(255,255,255,0.10)";

// generateStaticParams との整合（ビルド時にプリレンダリング）
export async function generateStaticParams() {
  return getGameSlugs().map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const game = getGame(params.slug);

  const [stats, fontData] = await Promise.all([
    game ? getGameStats(params.slug) : Promise.resolve(null),
    loadNotoSansJP(),
  ]);

  const fonts: ConstructorParameters<typeof ImageResponse>[1]["fonts"] = fontData
    ? [{ name: "Noto Sans JP", data: fontData, style: "normal" }]
    : [];

  if (!game) {
    return new ImageResponse(
      <div
        style={{
          width: "100%", height: "100%",
          background: "#0f2040",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ color: MUTED, fontSize: 32, fontFamily: "sans-serif" }}>
          Game not found
        </span>
      </div>,
      { ...size, fonts },
    );
  }

  const [bgFrom, bgTo] = GAME_GRADIENTS[game.slug] ?? DEFAULT_GRADIENT;

  // Top 3 セット（price あり優先）
  const topSets = (stats?.sets ?? [])
    .filter((s) => s.avgPrice !== null)
    .slice(0, 3);

  return new ImageResponse(
    <div
      style={{
        width: "100%", height: "100%",
        background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)`,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Noto Sans JP, sans-serif",
        padding: "52px 64px",
        position: "relative",
      }}
    >
      {/* ── 背景装飾: 右下大絵文字 ──────────────────────── */}
      <div
        style={{
          position: "absolute", right: 48, bottom: 16,
          fontSize: 280, opacity: 0.06,
          lineHeight: 1,
          display: "flex",
        }}
      >
        {game.emoji}
      </div>

      {/* ── GCI ブランド ─────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 36,
        }}
      >
        <span
          style={{
            fontSize: 14, fontWeight: 700, letterSpacing: 3,
            textTransform: "uppercase", color: MUTED,
          }}
        >
          Global Card Index
        </span>
        <span style={{ color: BORDER, fontSize: 14 }}>·</span>
        <span
          style={{
            fontSize: 14, letterSpacing: 2,
            textTransform: "uppercase", color: MUTED,
          }}
        >
          Market Data
        </span>
      </div>

      {/* ── ゲーム名（メイン） ───────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 10 }}>
        <span style={{ fontSize: 56 }}>{game.emoji}</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
            {game.nameJa}
          </span>
          <span
            style={{
              fontSize: 52, fontWeight: 700, color: WHITE,
              lineHeight: 1.15, display: "flex",
            }}
          >
            {game.name}
          </span>
        </div>
      </div>

      {/* ── 統計 3 指標 ──────────────────────────────────── */}
      <div
        style={{
          display: "flex", gap: 0,
          marginTop: 32,
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 28,
        }}
      >
        {[
          {
            label: "Cards",
            value: stats ? stats.cardCount.toLocaleString() : "—",
          },
          {
            label: "Sets",
            value: stats ? stats.setCount.toLocaleString() : "—",
          },
          {
            label: "Data Points",
            value: stats ? stats.priceCount.toLocaleString() : "—",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex", flexDirection: "column",
              flex: 1,
              paddingRight: 24,
              borderRight: i < 2 ? `1px solid ${BORDER}` : "none",
              paddingLeft: i > 0 ? 24 : 0,
            }}
          >
            <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
              {s.label}
            </span>
            <span
              style={{
                fontSize: 40, fontWeight: 700, color: WHITE,
                lineHeight: 1.2, marginTop: 4, display: "flex",
              }}
            >
              {s.value}
            </span>
          </div>
        ))}

        {/* 最新価格 */}
        {stats?.latestPrice !== null && stats?.currency && (
          <div
            style={{
              display: "flex", flexDirection: "column",
              flex: 1,
              paddingLeft: 24,
              borderLeft: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
              Latest Price
            </span>
            <span
              style={{
                fontSize: 40, fontWeight: 700, color: GOLD,
                lineHeight: 1.2, marginTop: 4, display: "flex",
              }}
            >
              {stats.latestPrice !== null && stats.currency
                ? formatPrice(stats.latestPrice, stats.currency)
                : "—"}
            </span>
          </div>
        )}
      </div>

      {/* ── Top Sets ─────────────────────────────────────── */}
      {topSets.length > 0 && (
        <div
          style={{
            display: "flex", gap: 10,
            marginTop: 24,
          }}
        >
          {topSets.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                padding: "8px 14px",
                flexDirection: "column",
                minWidth: 0,
                maxWidth: 300,
              }}
            >
              <span
                style={{
                  fontSize: 13, color: WHITE, fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "flex",
                }}
              >
                {s.setName}
              </span>
              {s.avgPrice !== null && s.currency && (
                <span style={{ fontSize: 12, color: GOLD, marginTop: 2, display: "flex" }}>
                  avg {formatPrice(s.avgPrice, s.currency)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>,
    { ...size, fonts },
  );
}
