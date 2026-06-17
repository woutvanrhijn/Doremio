import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── Colors ───────────────────────────────────────────────
      colors: {
        // Brand
        "primary":       "#0766C6",
        "primary-dark":  "#0552A0",
        "accent":        "#FF560D",
        "accent-dark":   "#D94400",
        "yellow":        "#FFD100",
        "yellow-dark":   "#E6BC00",

        // Backgrounds
        "warm-white":    "#F3E7DD",
        "navy":          "#0D1B2A",
        "navy-card":     "#122238",
        "navy-light":    "#1A2E45",

        // Neutral
        "white":         "#FFFFFF",
        "gray-muted":    "#8FA3B8",

        // Semantic
        "success":       "#22C55E",
        "success-dark":  "#16A34A",
      },

      // ─── Typography ───────────────────────────────────────────
      fontFamily: {
        apercu: ["var(--font-apercu)", "system-ui", "sans-serif"],
        kiro:   ["var(--font-kiro)",   "system-ui", "sans-serif"],
      },

      fontSize: {
        // Display — Kiro Bold
        "display-xl": ["2.25rem",  { lineHeight: "1.1", fontWeight: "700" }], // 36px
        "display-lg": ["1.875rem", { lineHeight: "1.1", fontWeight: "700" }], // 30px
        "display-md": ["1.5rem",   { lineHeight: "1.15", fontWeight: "700" }], // 24px

        // Headings — Apercu Bold
        "heading-xl": ["1.375rem", { lineHeight: "1.2", fontWeight: "700" }], // 22px
        "heading-lg": ["1.25rem",  { lineHeight: "1.2", fontWeight: "700" }], // 20px
        "heading-md": ["1.125rem", { lineHeight: "1.3", fontWeight: "700" }], // 18px
        "heading-sm": ["1rem",     { lineHeight: "1.3", fontWeight: "700" }], // 16px

        // Body — Apercu Regular
        "body-lg":    ["1rem",     { lineHeight: "1.5", fontWeight: "400" }], // 16px
        "body-md":    ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }], // 14px
        "body-sm":    ["0.75rem",  { lineHeight: "1.4", fontWeight: "400" }], // 12px

        // Label / Caption
        "label":      ["0.75rem",  { lineHeight: "1.3", fontWeight: "700" }], // 12px bold
        "caption":    ["0.6875rem",{ lineHeight: "1.3", fontWeight: "400" }], // 11px
      },

      // ─── Border Radius ────────────────────────────────────────
      borderRadius: {
        "none":  "0",
        "sm":    "8px",
        "md":    "12px",
        "lg":    "16px",
        "xl":    "20px",
        "2xl":   "24px",
        "3xl":   "32px",
        "full":  "9999px",
      },

      // ─── Spacing ──────────────────────────────────────────────
      spacing: {
        "0":   "0",
        "1":   "4px",
        "2":   "8px",
        "3":   "12px",
        "4":   "16px",
        "5":   "20px",
        "6":   "24px",
        "7":   "28px",
        "8":   "32px",
        "10":  "40px",
        "12":  "48px",
        "14":  "56px",
        "16":  "64px",
        "20":  "80px",
        "24":  "96px",
        "nav": "72px", // bottom nav height
      },

      // ─── Box Shadow ───────────────────────────────────────────
      boxShadow: {
        "card":       "0 2px 12px rgba(7, 102, 198, 0.12)",
        "card-navy":  "0 2px 16px rgba(0, 0, 0, 0.3)",
        "button":     "0 4px 12px rgba(255, 86, 13, 0.35)",
        "button-blue":"0 4px 12px rgba(7, 102, 198, 0.35)",
      },

      // ─── Background gradients ─────────────────────────────────
      backgroundImage: {
        "onboarding-gradient": "linear-gradient(135deg, #0766C6 0%, #FF560D 100%)",
        "navy-gradient":       "linear-gradient(180deg, #0D1B2A 0%, #122238 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
