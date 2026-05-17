/**
 * /cards/[slug]/opengraph-image.tsx
 *
 * Card 詳細ページ用 OG 画像。
 * 1200 × 630 px、ネイビー背景。
 */

import { ImageResponse } from "next/og";
import { getCardBySlug } from "@gci/core";
import { getGame }       from "@gci/core";
import { loadNotoSansJP } from "@/lib/og/fonts";
import { formatPrice }   from "@gci/core";

// Node.js ランタイム（Prisma を使うため）
export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const alt         = "Card price on Global Card Index";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

// ----------------------------------------------------------------
// デザイントークン（tailwind と揃える）
// ----------------------------------------------------------------
const NAVY   = "#0f2040";
const GOLD   = "#b8912a";
const WHITE  = "#ffffff";
const MUTED  = "rgba(255,255,255,0.45)";
const RED    = "#dc2626";
const GREEN  = "#b8912a";   // gold を"上昇色"として使う
const BORDER = "rgba(255,255,255,0.10)";

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const [card, fontData] = await Promise.all([
    getCardBySlug(params.slug),
    loadNotoSansJP(),
  ]);

  // フォント設定
  const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"] = fontData
    ? [{ name: "Noto Sans JP", data: fontData, style: "normal" }]
    : [];

  // カードが見つからなかった場合のフォールバック画像
  if (!card) {
    return new ImageResponse(
      <div
        style={{
          width: "100%", height: "100%",
          background: NAVY,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span style={{ color: MUTED, fontSize: 32, fontFamily: "Noto Sans JP, sans-serif" }}>
          Card not found
        </span>
      </div>,
      { ...size, fonts },
    );
  }

  const game       = card.game ? getGame(card.game) : null;
  const priceStr   = card.latestPrice !== null && card.currency
    ? formatPrice(card.latestPrice, card.currency)
    : null;
  const change7d   = card.change7d;
  const changeStr  = change7d !== null
    ? `${change7d > 0 ? "▲" : change7d < 0 ? "▼" : ""}${Math.abs(change7d).toFixed(1)}%`
    : null;
  const changeColor = change7d === null ? MUTED : change7d > 0 ? GREEN : change7d < 0 ? RED : MUTED;

  return new ImageResponse(
    <div
      style={{
        width: "100%", height: "100%",
        background: NAVY,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Noto Sans JP, sans-serif",
        padding: "56px 64px",
        position: "relative",
      }}
    >
      {/* ── 背景: 右側に大きな薄いロゴ文字 ─────────────────── */}
      <div
        style={{
          position: "absolute", right: 48, bottom: 32,
          fontSize: 220, fontWeight: 700, color: "rgba(255,255,255,0.03)",
          lineHeight: 1, letterSpacing: -8,
          display: "flex",
        }}
      >
        GCI
      </div>

      {/* ── ゲームバッジ ─────────────────────────────────── */}
      {game && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 22 }}>{game.emoji}</span>
          <span
            style={{
              fontSize: 13, letterSpacing: 3, textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {game.name}
          </span>
        </div>
      )}

      {/* ── セット名 ─────────────────────────────────────── */}
      <div
        style={{
          fontSize: 16, letterSpacing: 2, textTransform: "uppercase",
          color: MUTED, marginBottom: 12, display: "flex",
        }}
      >
        {card.setName}
      </div>

      {/* ── カード名（メイン） ───────────────────────────── */}
      <div
        style={{
          fontSize: card.name.length > 24 ? 52 : 64,
          fontWeight: 700,
          color: WHITE,
          lineHeight: 1.1,
          marginBottom: 8,
          display: "flex",
          flexWrap: "wrap",
        }}
      >
        {card.name}
      </div>

      {/* ── レアリティ · コンディション ─────────────────── */}
      <div
        style={{
          fontSize: 18, color: MUTED, marginBottom: 40, display: "flex",
        }}
      >
        {card.rarity}
        <span style={{ margin: "0 10px", opacity: 0.4 }}>·</span>
        {card.condition}
      </div>

      {/* ── 価格 + 変動 ──────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "flex-end", gap: 24,
          marginTop: "auto",
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 32,
        }}
      >
        {/* 現在価格 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
            Latest Price
          </span>
          <span
            style={{
              fontSize: 56, fontWeight: 700,
              color: priceStr ? GOLD : MUTED,
              lineHeight: 1.1,
              marginTop: 4,
              display: "flex",
            }}
          >
            {priceStr ?? "—"}
          </span>
        </div>

        {/* 7日変動 */}
        {changeStr && (
          <div
            style={{
              display: "flex", flexDirection: "column",
              marginBottom: 6, marginLeft: 8,
            }}
          >
            <span style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
              7D
            </span>
            <span
              style={{
                fontSize: 36, fontWeight: 700,
                color: changeColor,
                lineHeight: 1.1, marginTop: 4,
                display: "flex",
              }}
            >
              {changeStr}
            </span>
          </div>
        )}

        {/* 観測件数 */}
        <div
          style={{
            display: "flex", flexDirection: "column",
            marginBottom: 6, marginLeft: "auto",
          }}
        >
          <span style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
            Data Points
          </span>
          <span
            style={{
              fontSize: 32, fontWeight: 400,
              color: MUTED,
              lineHeight: 1.1, marginTop: 4,
              display: "flex",
            }}
          >
            {card.priceCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── ブランド ─────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", top: 56, right: 64,
          display: "flex", flexDirection: "column", alignItems: "flex-end",
        }}
      >
        <span
          style={{
            fontSize: 22, fontWeight: 700, letterSpacing: 1,
            color: "rgba(255,255,255,0.8)",
            display: "flex",
          }}
        >
          GCI
        </span>
        <span
          style={{
            fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
            color: MUTED, marginTop: 2, display: "flex",
          }}
        >
          Global Card Index
        </span>
      </div>
    </div>,
    { ...size, fonts },
  );
}
