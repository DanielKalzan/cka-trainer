import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark-first surface scale
        bg: "#0b0f14",
        surface: "#11161d",
        raised: "#171e27",
        edge: "#232c37",
        // Text
        ink: "#e6edf3",
        muted: "#8b98a5",
        faint: "#5c6773",
        // Brand + semantic
        accent: "#4f8ff7",
        success: "#4ade80",
        warning: "#fbbf24",
        danger: "#f87171",
        // Terminal
        term: {
          bg: "#0a0d11",
          green: "#3fdc97",
          prompt: "#7ee2b8",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
