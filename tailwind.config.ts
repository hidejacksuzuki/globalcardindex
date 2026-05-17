import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ブランドカラー（既存）
        navy: {
          DEFAULT: "#0B1B3B",
          50:  "#F2F4F8",
          100: "#D8DEE9",
          900: "#0B1B3B",
          950: "#06112A",
        },
        gold: {
          DEFAULT: "#C9A14A",
          100: "#F0E5C8",
          500: "#C9A14A",
          700: "#9C7A2F",
        },
        // 価格上昇
        bull: {
          DEFAULT: "#22c55e",
          light:   "#dcfce7",
          dark:    "#15803d",
        },
        // 価格下落
        bear: {
          DEFAULT: "#ef4444",
          light:   "#fee2e2",
          dark:    "#b91c1c",
        },
        // サーフェス
        surface: {
          DEFAULT: "#ffffff",
          muted:   "#f8fafc",
          border:  "#e2e8f0",
        },
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        mono:    ["ui-monospace", "SFMono-Regular", "monospace"],
        numeric: ["ui-monospace", "tabular-nums", "monospace"],
      },
      maxWidth: {
        "8xl": "88rem",
      },
      // 価格変動時のフラッシュアニメーション
      keyframes: {
        "price-up": {
          "0%":   { backgroundColor: "#dcfce7" },
          "100%": { backgroundColor: "transparent" },
        },
        "price-down": {
          "0%":   { backgroundColor: "#fee2e2" },
          "100%": { backgroundColor: "transparent" },
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "price-up":   "price-up 1s ease-out",
        "price-down": "price-down 1s ease-out",
        "fade-in":    "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
