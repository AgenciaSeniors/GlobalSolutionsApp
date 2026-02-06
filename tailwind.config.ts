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
        // Oficiales
        navy: "#0F2545",
        coral: "#FF4757",

        // Paleta "brand" para todo lo que ya usa brand-50/600/900/etc.
        brand: {
          50:  "#f3f7fb",
          100: "#e7eff7",
          200: "#c4d8ea",
          300: "#97b9d7",
          400: "#5f90bd",
          500: "#2f6ba3",
          600: "#215487",
          700: "#173e66",
          800: "#102f4e",
          900: "#0F2545", // Navy oficial
          950: "#08172d",
        },

        // Acento (CTA)
        accent: {
          500: "#FF4757", // Coral oficial
        },
      },
      fontFamily: {
        heading: ['"Roboto Condensed"', "sans-serif"],
        body: ['"Open Sans"', "sans-serif"],
        script: ['"Dancing Script"', "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
