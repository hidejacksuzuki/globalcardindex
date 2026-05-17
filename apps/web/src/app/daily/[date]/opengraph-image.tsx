/**
 * /daily/[date]/opengraph-image.tsx
 * アーカイブページ用 OG 画像。/daily/opengraph-image.tsx と同じレイアウトで
 * DB から取得したスナップショットを描画する。
 */

import { ImageResponse }        from "next/og";
import { getDailyRecapByDate }  from "@gci/core";
import { loadNotoSansJP }       from "@/lib/og/fonts";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const alt         = "Daily Market Recap — Global Card Index";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY  = "#0f2040";
const WHITE = "#ffffff";
const GOLD  = "#b8912a";
const RED   = "#dc2626";
const MUTED = "rgba(255,255,255,0.40)";
const SEP   = "rgba(255,255,255,0.08)";

export default async function Image({ params }: { params: { date: string } }) {
  const [recap, fontData] = await Promise.all([
    getDailyRecapByDate(params.date),
    loadNotoSansJP(),
  ]);

  const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"] = fontData
    ? [{ name: "Noto Sans JP", data: fontData, style: "normal" }]
    : [];

  // スナップショットが無い場合のフォールバック
  if (!recap) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: MUTED, fontSize: 28, fontFamily: "sans-serif" }}>
          {params.date} — No data
        </span>
      </div>,
      { ...size, fonts },
    );
  }

  const displayDate = new Date(params.date + "T00:00:00+09:00").toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });

  const topGainer = recap.gainers[0] ?? null;
  const topLoser  = recap.losers[0]  ?? null;
  const topSpike  = recap.spikes[0]  ?? null;
  const indexChange = recap.index?.change24h ?? recap.index?.changeRate ?? null;
  const indexColor  = indexChange === null ? MUTED : indexChange > 0 ? GOLD : RED;
  const indexStr    = indexChange !== null
    ? `${indexChange > 0 ? "+" : ""}${indexChange.toFixed(2)}%`
    : "—";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex",
      flexDirection: "column", fontFamily: "Noto Sans JP, sans-serif",
      padding: "48px 60px", position: "relative" }}>
      {/* 背景装飾 */}
      <div style={{ position: "absolute", right: 50, bottom: 20, fontSize: 200, fontWeight: 800,
        color: "rgba(255,255,255,0.025)", letterSpacing: -6, lineHeight: 1, display: "flex" }}>
        DAILY
      </div>

      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", color: MUTED }}>
            Global Card Index · Archive
          </span>
          <span style={{ fontSize: 32, fontWeight: 700, color: WHITE, marginTop: 4, display: "flex" }}>
            Daily Market Recap
          </span>
          <span style={{ fontSize: 15, color: MUTED, marginTop: 4, display: "flex" }}>
            {displayDate}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)", border: `1px solid ${SEP}`, borderRadius: 6,
          padding: "12px 20px" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>GCI Index</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: indexColor, marginTop: 4, display: "flex" }}>{indexStr}</span>
          {recap.index && (
            <span style={{ fontSize: 13, color: MUTED, display: "flex" }}>{recap.index.value.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* 3カラム */}
      <div style={{ display: "flex", gap: 16, marginTop: "auto", paddingTop: 32,
        borderTop: `1px solid ${SEP}` }}>
        {/* Gainer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          background: "rgba(184,145,42,0.08)", border: "1px solid rgba(184,145,42,0.25)",
          borderRadius: 6, padding: "16px 20px" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: GOLD }}>▲ Top Gainer</span>
          {topGainer ? (
            <>
              <span style={{ fontSize: topGainer.cardName.length > 18 ? 17 : 20, fontWeight: 700,
                color: WHITE, marginTop: 8, lineHeight: 1.2, display: "flex" }}>{topGainer.cardName}</span>
              <span style={{ fontSize: 12, color: MUTED, marginTop: 4, display: "flex" }}>{topGainer.setName}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: GOLD, marginTop: 8, display: "flex" }}>
                {topGainer.change7d !== null ? `+${topGainer.change7d.toFixed(1)}%` : "—"}
              </span>
            </>
          ) : <span style={{ fontSize: 14, color: MUTED, marginTop: 8, display: "flex" }}>—</span>}
        </div>

        {/* Loser */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.20)",
          borderRadius: 6, padding: "16px 20px" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: RED }}>▼ Top Loser</span>
          {topLoser ? (
            <>
              <span style={{ fontSize: topLoser.cardName.length > 18 ? 17 : 20, fontWeight: 700,
                color: WHITE, marginTop: 8, lineHeight: 1.2, display: "flex" }}>{topLoser.cardName}</span>
              <span style={{ fontSize: 12, color: MUTED, marginTop: 4, display: "flex" }}>{topLoser.setName}</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: RED, marginTop: 8, display: "flex" }}>
                {topLoser.change7d !== null ? `${topLoser.change7d.toFixed(1)}%` : "—"}
              </span>
            </>
          ) : <span style={{ fontSize: 14, color: MUTED, marginTop: 8, display: "flex" }}>—</span>}
        </div>

        {/* Spike */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          background: "rgba(147,51,234,0.07)", border: "1px solid rgba(147,51,234,0.20)",
          borderRadius: 6, padding: "16px 20px" }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            color: "rgba(167,139,250,0.9)" }}>⚡ Vol Spike</span>
          {topSpike ? (
            <>
              <span style={{ fontSize: topSpike.cardName.length > 18 ? 17 : 20, fontWeight: 700,
                color: WHITE, marginTop: 8, lineHeight: 1.2, display: "flex" }}>{topSpike.cardName}</span>
              <span style={{ fontSize: 12, color: MUTED, marginTop: 4, display: "flex" }}>{topSpike.setName}</span>
              <span style={{ fontSize: 26, fontWeight: 700, marginTop: 8, display: "flex",
                color: "rgba(167,139,250,0.9)" }}>
                {topSpike.count24h}
                <span style={{ fontSize: 14, marginLeft: 4, marginTop: 8, fontWeight: 400, color: MUTED }}>listings</span>
              </span>
            </>
          ) : <span style={{ fontSize: 14, color: MUTED, marginTop: 8, display: "flex" }}>—</span>}
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
