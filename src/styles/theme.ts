/**
 * @fileoverview Design tokens accessible from JS when Tailwind classes
 *               are not enough (e.g. chart colours, dynamic styles).
 * @module styles/theme
 */

// src/styles/theme.ts

export const theme = {
  colors: {
    navy: "#0F2545",     // principal Global Solutions
    coral: "#FF4757",    // acento / CTA
    white: "#FFFFFF",

    // neutros útiles para UI
    gray100: "#F5F7FA",
    gray300: "#D6DCE6",
    ink: "#0B1220",
  },

  typography: {
    heading: "Roboto Condensed, Oswald, sans-serif",
    body: "Open Sans, Lato, system-ui, sans-serif",
    script: "Dancing Script, Pacifico, cursive",
  },

  radius: {
    sm: "10px",
    md: "14px",
    lg: "18px",
  },
};
