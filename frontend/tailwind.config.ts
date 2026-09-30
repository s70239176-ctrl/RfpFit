import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0C0A",
        paper: "#141511",
        rule: "#2A2C26",
        fg: "#F3F1EA",
        muted: "#A7A49A",
        copper: "#C47A3A",
        good: "#7F9A72",
        bad: "#C45C4A",
        partial: "#C9A227",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "8px", lg: "12px" },
      maxWidth: { page: "1120px" },
    },
  },
  plugins: [],
};

export default config;
