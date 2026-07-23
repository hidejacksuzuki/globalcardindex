"use client";

import { useState, useMemo } from "react";
import type { PricePoint }   from "@gci/core";

type Period = "7d" | "30d" | "90d";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "7d",  label: "7日",  days: 7  },
  { key: "30d", label: "30日", days: 30 },
  { key: "90d", label: "90日", days: 90 },
];

// SVG canvas constants
const W     = 600;
const H     = 180;
const PAD_T = 16;
const PAD_R = 16;
const PAD_B = 32;
const PAD_L = 64;
const IW    = W - PAD_L - PAD_R;
const IH    = H - PAD_T - PAD_B;

function fmt(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style:                 "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${Math.round(price)} ${currency}`;
  }
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type Props = {
  points:      PricePoint[];
  defaultPeriod?: Period;
};

/**
 * 指定期間に2点以上あるかを判定
 */
function hasEnough(points: PricePoint[], days: number): boolean {
  const cutoff = Date.now() - days * 86_400_000;
  let n = 0;
  for (const p of points) {
    if (new Date(p.date).getTime() >= cutoff) {
      if (++n >= 2) return true;
    }
  }
  return false;
}

/**
 * 初期表示する期間を決める。希望の期間にデータが無ければ、データのある
 * 最短の期間へ自動フォールバックする（希望が30日でも、直近データが40日前
 * までしか無いカードで空チャートを出さないため）。
 */
function pickInitialPeriod(points: PricePoint[], preferred: Period): Period {
  const daysOf = (k: Period) => PERIODS.find((p) => p.key === k)!.days;
  if (hasEnough(points, daysOf(preferred))) return preferred;
  for (const { key } of PERIODS) {
    if (hasEnough(points, daysOf(key))) return key;
  }
  return "90d";
}

export function PriceChart({ points, defaultPeriod = "30d" }: Props) {
  const [period, setPeriod] = useState<Period>(() => pickInitialPeriod(points, defaultPeriod));

  const filtered = useMemo(() => {
    const days    = PERIODS.find((p) => p.key === period)!.days;
    const cutoff  = new Date(Date.now() - days * 86_400_000);
    return points.filter((p) => new Date(p.date) >= cutoff);
  }, [points, period]);

  // ── SVG geometry ─────────────────────────────────────────────
  const geo = useMemo(() => {
    if (filtered.length < 2) return null;

    const prices = filtered.map((p) => p.price);
    const minP   = Math.min(...prices);
    const maxP   = Math.max(...prices);
    const range  = maxP - minP || maxP * 0.1 || 1;
    const n      = filtered.length;

    const xs = filtered.map((_, i) => PAD_L + (i / (n - 1)) * IW);
    const ys = filtered.map((p) =>
      PAD_T + (1 - (p.price - minP) / range) * IH,
    );

    const polyline = xs
      .map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`)
      .join(" ");

    const areaPath =
      `M${xs[0].toFixed(1)},${ys[0].toFixed(1)} ` +
      xs.map((x, i) => `L${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ") +
      ` L${xs[n - 1].toFixed(1)},${(PAD_T + IH).toFixed(1)}` +
      ` L${xs[0].toFixed(1)},${(PAD_T + IH).toFixed(1)} Z`;

    // 3 Y-axis ticks
    const yTicks = [
      { value: maxP, y: PAD_T },
      { value: (minP + maxP) / 2, y: PAD_T + IH / 2 },
      { value: minP, y: PAD_T + IH },
    ];

    // ~4 evenly-spaced X labels
    const step = Math.max(1, Math.floor((n - 1) / 4));
    const xIdxs = new Set<number>([0]);
    for (let i = step; i < n - 1; i += step) xIdxs.add(i);
    xIdxs.add(n - 1);
    const xLabels = [...xIdxs].map((i) => ({
      x:     xs[i],
      label: dateLabel(filtered[i].date),
    }));

    return {
      xs, ys, polyline, areaPath, yTicks, xLabels,
      currency: filtered[0].currency,
      lastPrice: filtered[n - 1].price,
      firstPrice: filtered[0].price,
    };
  }, [filtered]);

  const trend = geo
    ? geo.lastPrice >= geo.firstPrice ? "up" : "down"
    : null;

  const lineColor  = trend === "up" ? "#1d6832" : trend === "down" ? "#b91c1c" : "#0f2255";
  const areaColor  = trend === "up" ? "#1d6832" : trend === "down" ? "#b91c1c" : "#0f2255";

  return (
    <div>
      {/* Period tabs */}
      <div className="flex items-center gap-1 mb-4">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-3 py-1 text-xs transition border ${
              period === key
                ? "border-navy bg-navy text-white"
                : "border-navy/15 text-navy/50 hover:border-navy/40 hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {!geo ? (
        <div className="flex items-center justify-center h-28 text-sm text-navy/40 border border-dashed border-navy/10">
          この期間のデータが不足しています
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 180, display: "block" }}
          aria-label="価格推移チャート"
        >
          {/* Y-axis grid lines + labels */}
          {geo.yTicks.map(({ value, y }, i) => (
            <g key={i}>
              <line
                x1={PAD_L} y1={y}
                x2={W - PAD_R} y2={y}
                stroke="#0f2255" strokeOpacity={0.07} strokeWidth={1}
              />
              <text
                x={PAD_L - 8} y={y}
                textAnchor="end" dominantBaseline="middle"
                fill="#0f2255" fillOpacity={0.45}
                fontSize={10} fontFamily="ui-monospace,SFMono-Regular,monospace"
              >
                {fmt(value, geo.currency)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={geo.areaPath} fill={areaColor} fillOpacity={0.07} />

          {/* Line */}
          <polyline
            points={geo.polyline}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.5}
            strokeOpacity={0.85}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Start + end dots */}
          {[0, filtered.length - 1].map((i) => (
            <circle
              key={i}
              cx={geo.xs[i]} cy={geo.ys[i]} r={3}
              fill={lineColor} fillOpacity={0.8}
            />
          ))}

          {/* X-axis labels */}
          {geo.xLabels.map(({ x, label }, i) => (
            <text
              key={i}
              x={x} y={H - 6}
              textAnchor="middle"
              fill="#0f2255" fillOpacity={0.4}
              fontSize={10}
            >
              {label}
            </text>
          ))}
        </svg>
      )}

      {/* Sample count note */}
      <p className="mt-1 text-right text-[10px] text-navy/30">
        {filtered.length} 件のデータ
      </p>
    </div>
  );
}
