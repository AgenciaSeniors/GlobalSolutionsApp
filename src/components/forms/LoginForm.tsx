/**
 * @fileoverview Login form with client-side Zod validation and Supabase auth.
 * @module components/forms/LoginForm
 */
'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

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
      // ✅ Pasa ?redirect=/... si viene de una ruta protegida (middleware)
      await login(result.data.email, result.data.password, redirect ?? undefined);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  }

  const update = (field: keyof LoginFormValues) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red"
          role="alert"
        >
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
