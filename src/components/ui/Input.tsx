/**
 * @fileoverview Reusable Input with label, optional icon, and error message.
 * @module components/ui/Input
 */
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700"
          >
            {icon && <span className="text-brand-500">{icon}</span>}
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3',
            'text-[15px] text-neutral-900 placeholder:text-neutral-400',
            'transition-colors duration-200',
            'focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/20',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm font-medium text-accent-red"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
