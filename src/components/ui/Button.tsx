/**
 * @fileoverview Reusable Button with variant system, sizes and loading state.
 * @module components/ui/Button
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all " +
  "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60 select-none";

const variants: Record<ButtonVariant, string> = {
 primary: "bg-coral text-white shadow-sm hover:brightness-[0.98] active:translate-y-[0.5px]",

  outline:
    "bg-white text-brand-900 border-2 border-brand-200 " +
    "hover:border-brand-300 hover:bg-brand-50 active:translate-y-[0.5px]",

  ghost:
  "bg-transparent text-navy border-2 border-navy " +
  "hover:bg-white/60 active:translate-y-[0.5px]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-[15px]",
};

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    isLoading = false,
    disabled,
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {isLoading && <Spinner />}
      <span className={cn(isLoading && "opacity-90")}>{children}</span>
    </button>
  );
});

export default Button;