import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/core/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1A2B5E",
          50:  "#F0F2F8",
          100: "#D0D6E8",
          400: "#5A6FA8",
          900: "#1A2B5E",
          950: "#101B40",
        },
        gold: {
          DEFAULT: "#B8963C",
          100: "#F5EDD0",
          400: "#D4B060",
          500: "#B8963C",
          700: "#8A6E28",
        },
        bull: {
          DEFAULT: "#22c55e",
          light:   "#dcfce7",
          dark:    "#15803d",
        },
        bear: {
          DEFAULT: "#ef4444",
          light:   "#fee2e2",
          dark:    "#b91c1c",
        },
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
