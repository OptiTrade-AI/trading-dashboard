import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        accent: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
        },
        profit: "#10b981",
        loss: "#ef4444",
        caution: "#f59e0b",
        card: {
          DEFAULT: "rgba(24, 24, 27, 0.8)",
          solid: "#18181b",
        },
        border: "rgba(63, 63, 70, 0.5)",
        muted: "#71717a",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-accent': 'radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
        'glow-profit': 'radial-gradient(circle at center, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
        'glow-loss': 'radial-gradient(circle at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(16, 185, 129, 0.15)',
        'glow-sm': '0 0 10px rgba(16, 185, 129, 0.1)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
