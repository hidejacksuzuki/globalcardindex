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
    },
  },
  plugins: [],
};

export default config;
