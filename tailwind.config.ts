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
        navy: "#0F2545",
        coral: "#FF4757",
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
