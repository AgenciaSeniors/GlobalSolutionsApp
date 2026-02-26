/**
 * @fileoverview Reusable Input with label, optional icon, error message,
 *               and optional password visibility toggle.
 * @module components/ui/Input
 */
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  /** Show an eye icon to toggle password visibility (only for type="password") */
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, label, type, showPasswordToggle, ...props },
  ref
) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isPasswordField = type === "password";
  const effectiveType = isPasswordField && passwordVisible ? "text" : type;
  const showToggle = isPasswordField && showPasswordToggle;

  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-sm font-medium text-brand-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          type={effectiveType}
          className={cn(
            "w-full rounded-xl border-2 px-4 py-3 text-[15px] font-medium",
            "border-brand-200 bg-white text-brand-900",
            "placeholder:text-neutral-400",
            "focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 focus:outline-none",
            "transition-all",
            showToggle && "pr-12",
            error && "border-accent-red focus:border-accent-red focus:ring-accent-red/20",
            className
          )}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setPasswordVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {passwordVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-medium text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
