/**
 * @fileoverview Client registration form with comprehensive Zod validation.
 * @module components/forms/RegisterForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

type FormFields = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
};

export default function RegisterForm() {
  const { register, isLoading } = useAuth();
  const [form, setForm] = useState<FormFields>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormFields;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    try {
      await register({
        email: result.data.email,
        password: result.data.password,
        fullName: result.data.full_name,
      });
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Error al registrarse',
      );
    }
  }

  const update = (field: keyof FormFields) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {serverError}
        </div>
      )}

      <Input
        label="Nombre Completo"
        placeholder="María García"
        value={form.full_name}
        onChange={update('full_name')}
        error={errors.full_name}
        required
      />

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
        label="Teléfono (opcional)"
        type="tel"
        placeholder="+53 5555 5555"
        value={form.phone}
        onChange={update('phone')}
      />

      <Input
        label="Contraseña"
        type="password"
        placeholder="Mínimo 8 caracteres"
        value={form.password}
        onChange={update('password')}
        error={errors.password}
        required
      />

      <Input
        label="Confirmar Contraseña"
        type="password"
        placeholder="Repetir contraseña"
        value={form.confirm_password}
        onChange={update('confirm_password')}
        error={errors.confirm_password}
        required
      />

      <Button type="submit" isLoading={isLoading} className="w-full">
        Crear Cuenta
      </Button>

      <p className="text-center text-sm text-neutral-600">
        ¿Ya tienes cuenta?{' '}
        <Link href={ROUTES.LOGIN} className="font-semibold text-brand-600 hover:underline">
          Inicia sesión
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Conexión segura · Datos encriptados con AES-256
      </p>
    </form>
  );
}
