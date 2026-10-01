import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050505",
        paper: "#18181B",
        rule: "#27272A",
        fg: "#FFFFFF",
        muted: "#A1A1AA",
        primary: "#FF5A1F",
        accent: "#FF6B00",
        good: "#4ADE80",
        bad: "#F87171",
        partial: "#FACC15",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "8px", lg: "8px", pill: "9999px" },
      maxWidth: { page: "1120px" },
    },
  },
  plugins: [],
};

export default config;
