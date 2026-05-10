import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0d0f14",
          card: "#161b26",
          border: "#252d3d",
          accent: "#3b82f6",
          gold: "#f59e0b",
          red: "#ef4444",
          green: "#22c55e",
          muted: "#6b7280",
          text: "#e2e8f0",
          subtext: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
