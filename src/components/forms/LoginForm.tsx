/**
 * @fileoverview Login form with redirect support for guest→checkout flow.
 * Per spec §3.1: Guest searches freely, login required only at checkout.
 * Supports ?redirect= param to return user to checkout after login.
 * @module components/forms/LoginForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Shield } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  const confirmed = searchParams.get('confirmed') === 'true';

  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof LoginFormValues;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    try {
      await login(result.data.email, result.data.password, redirect || undefined);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Error al iniciar sesión',
      );
    }
  }

  const update = (field: keyof LoginFormValues) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email confirmed notice */}
      {confirmed && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
          ✅ <strong>¡Correo confirmado!</strong> Ahora puedes iniciar sesión.
        </div>
      )}

      {/* Redirect notice */}
      {redirect && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Inicia sesión para continuar con tu compra.
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {serverError}
        </div>
      )}

      <Input
        label="Correo Electrónico"
        type="email"
        placeholder="correo@ejemplo.com"
        value={form.email}
        onChange={update('email')}
        error={errors.email}
        required
      />

      <Input
        label="Contraseña"
        type="password"
        placeholder="••••••••"
        value={form.password}
        onChange={update('password')}
        error={errors.password}
        required
      />

      <div className="flex items-center justify-end">
        <Link
          href={ROUTES.FORGOT_PASSWORD}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        Iniciar Sesión
      </Button>

      <p className="text-center text-sm text-neutral-600">
        ¿No tienes cuenta?{' '}
        <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 hover:underline">
          Regístrate
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Conexión segura · Datos encriptados con AES-256
      </p>
    </form>
  );
}
