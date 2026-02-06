/**
 * @fileoverview Reusable Button with variant system, sizes and loading state.
 * @module components/ui/Button
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { theme } from "@/styles/theme";

type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: ButtonSize;
  className?: string;
};

export default function Button({
  children,
  size = "md",
  className,
  style,
  ...rest
}: Props) {
  const padding =
    size === "sm" ? "10px 14px" : size === "lg" ? "14px 22px" : "12px 18px";

  return (
    <button
      {...rest}
      className={className}
      style={{
        background: theme.colors.coral,
        color: theme.colors.white,
        borderRadius: theme.radius.md,
        padding,
        fontWeight: "700",
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
