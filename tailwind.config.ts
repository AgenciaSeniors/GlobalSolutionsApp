/**
 * @fileoverview Tailwind CSS configuration with Global Solutions Travel
 *               brand tokens, custom animations and typography.
 * @module tailwind.config
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca
        navy: "#0F2545",
        coral: "#FF4757",

        // Brand scale (para fondos, bordes, estados suaves)
        brand: {
          50: "#f3f7fb",
          100: "#e7eff7",
          200: "#c4d8ea",
          300: "#97b9d7",
          400: "#5f90bd",
          500: "#2f6ba3",
          600: "#215487",
          700: "#173e66",
          800: "#102f4e",
          900: "#0F2545",
          950: "#08172d",
        },

        // Acento (CTA coral) + estados
        accent: {
          500: "#FF4757", // coral
          red: "#ef4444",
          green: "#10b981",
          yellow: "#fbbf24",
        },
      },

      fontFamily: {
       heading: ['"Oswald"', '"Roboto Condensed"', "sans-serif"],
        body: ['"Open Sans"', "sans-serif"],
        script: ['"Dancing Script"', "cursive"],
      },

      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 rgba(255,71,87,0)" },
          "50%": { boxShadow: "0 18px 45px rgba(255,71,87,0.25)" },
        },
      },

      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-in": "fade-in 300ms ease-out forwards",
        "fade-in-up": "fade-in-up 520ms ease-out forwards",
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
