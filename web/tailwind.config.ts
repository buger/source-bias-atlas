import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d12",
          elevated: "#13161d",
          panel: "#1a1e27",
        },
        line: "#262b36",
        ink: {
          DEFAULT: "#e6e8ec",
          muted: "#9aa0ac",
          subtle: "#6a7180",
        },
        accent: {
          DEFAULT: "#ff5b1f", // daily.dev-ish orange
          alt: "#7c5cff",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
