/**
 * @fileoverview Layout wrapper for /guia/* guide pages.
 * Passes children through without extra wrapping.
 * @module app/(public)/guia/layout
 */
export default function GuiaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
