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
        gold: {
          50: "#fdf9ee",
          100: "#f8eecf",
          200: "#f0dc9e",
          300: "#e6c565",
          400: "#dcae3a",
          500: "#c9922a",
          600: "#a87221",
          700: "#85541f",
          800: "#6f4420",
          900: "#5e391f",
        },
        ink: {
          500: "#2a3550",
          600: "#1f2a42",
          700: "#161f33",
          800: "#0f1626",
          900: "#080d17",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "serif"],
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(220,174,58,.45)",
        card: "0 20px 60px -20px rgba(0,0,0,.55)",
      },
    },
  },
  plugins: [],
};

export default config;
