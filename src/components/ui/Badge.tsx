/**
 * @fileoverview Inline Badge for statuses, labels and urgency indicators.
 * @module components/ui/Badge
 */
import * as React from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const variants = {
  default: "bg-brand-100 text-brand-700",
  info: "bg-brand-100 text-brand-700",
  offer: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  destructive: "bg-red-100 text-red-700",
  outline: "border border-neutral-300 text-neutral-600",
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export default function Badge({
  variant = "default",
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
