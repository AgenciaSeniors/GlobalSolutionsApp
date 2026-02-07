/**
 * @fileoverview Reusable Input with label, optional icon, and error message.
 * @module components/ui/Input
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return (
    <div className="w-full space-y-1">
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border-2 px-4 py-3 text-[15px] font-medium",
          "border-brand-200 bg-white text-brand-900",
          "placeholder:text-neutral-400",
          "focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none",
          "transition-all",
          error && "border-accent-red focus:border-accent-red focus:ring-accent-red/20",
          className
        )}
        {...props}
      />

      {error && (
        <p className="text-sm font-medium text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
