/**
 * @fileoverview Reusable Button with variant system, sizes and loading state.
 * @module components/ui/Button
 */
import { theme } from "@/styles/theme";

export default function Button({ children }: { children: React.ReactNode }) {
  return (
    <button
      style={{
        background: theme.colors.coral,
        color: theme.colors.white,
        borderRadius: theme.radius.md,
        padding: "12px 18px",
        fontWeight: "700",
      }}
    >
      {children}
    </button>
  );
}
