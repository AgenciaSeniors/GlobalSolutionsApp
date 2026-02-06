/**
 * @fileoverview Client registration form (hybrid auth: OTP + password).
 * @module components/forms/RegisterForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, Mail, KeyRound } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import {
  registerRequestSchema,
  otpSchema,
  setPasswordSchema,
} from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

type Step = 'request' | 'verify' | 'password';

type RequestFields = {
  full_name: string;
  email: string;
  phone?: string;
};

type VerifyFields = {
  code: string;
};

type PasswordFields = {
  password: string;
  confirm_password: string;
};

export default function RegisterForm() {
  const { requestRegisterOtp, verifyRegisterOtp, setPassword, isLoading } = useAuth();

  const [step, setStep] = useState<Step>('request');

  const [request, setRequest] = useState<RequestFields>({
    full_name: '',
    email: '',
    phone: '',
  });

  const [verify, setVerify] = useState<VerifyFields>({ code: '' });

  const [pw, setPw] = useState<PasswordFields>({
    password: '',
    confirm_password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function clearErrors() {
    setErrors({});
    setServerError(null);
  }

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    clearErrors();

    const result = registerRequestSchema.safeParse(request);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await requestRegisterOtp({
        email: result.data.email,
        fullName: result.data.full_name,
      });
      setStep('verify');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al enviar el código');
    }
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault();
    clearErrors();

    const result = otpSchema.safeParse(verify);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await verifyRegisterOtp(request.email, result.data.code);
      setStep('password');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Código inválido');
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    clearErrors();

    const result = setPasswordSchema.safeParse(pw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await setPassword(result.data.password);
      // setPassword already redirects by role on success
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al guardar la contraseña');
    }
  }

  const updateRequest = (field: keyof RequestFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRequest((prev) => ({ ...prev, [field]: e.target.value }));

  const updateVerify = (field: keyof VerifyFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVerify((prev) => ({ ...prev, [field]: e.target.value }));

  const updatePw = (field: keyof PasswordFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPw((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      {serverError && (
        <div
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red"
          role="alert"
        >
          {serverError}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={submitRequest} className="space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-50 p-2">
                <Mail className="h-5 w-5 text-brand-700" />
              </div>
              <div>
                <p className="font-semibold text-brand-950">Crear cuenta con código (6 dígitos)</p>
                <p className="text-sm text-brand-600">
                  Te enviaremos un código a tu correo para verificarlo.
                </p>
              </div>
            </div>
          </div>

          <Input
            label="Nombre completo"
            value={request.full_name}
            onChange={updateRequest('full_name')}
            error={errors.full_name}
            placeholder="Ej: Edua Perez"
          />

          <Input
            label="Correo electrónico"
            value={request.email}
            onChange={updateRequest('email')}
            error={errors.email}
            placeholder="tu@correo.com"
            type="email"
            autoComplete="email"
          />

          <Input
            label="Teléfono (opcional)"
            value={request.phone ?? ''}
            onChange={updateRequest('phone')}
            error={errors.phone}
            placeholder="+1 ..."
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Enviar código
          </Button>

          <p className="text-center text-sm text-brand-600">
            ¿Ya tienes cuenta?{' '}
            <Link href={ROUTES.LOGIN} className="font-semibold text-brand-800 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={submitVerify} className="space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-50 p-2">
                <Shield className="h-5 w-5 text-brand-700" />
              </div>
              <div>
                <p className="font-semibold text-brand-950">Verifica tu correo</p>
                <p className="text-sm text-brand-600">
                  Ingresa el código de 6 dígitos enviado a <span className="font-medium">{request.email}</span>.
                </p>
              </div>
            </div>
          </div>

          <Input
            label="Código (6 dígitos)"
            value={verify.code}
            onChange={updateVerify('code')}
            error={errors.code}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setStep('request')}
              disabled={isLoading}
            >
              Cambiar correo
            </Button>
            <Button type="submit" isLoading={isLoading} className="w-full">
              Verificar
            </Button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={submitPassword} className="space-y-4">
          <div className="rounded-2xl border border-brand-100 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-brand-50 p-2">
                <KeyRound className="h-5 w-5 text-brand-700" />
              </div>
              <div>
                <p className="font-semibold text-brand-950">Crea tu contraseña</p>
                <p className="text-sm text-brand-600">
                  Así podrás iniciar sesión también con contraseña cuando quieras.
                </p>
              </div>
            </div>
          </div>

          <Input
            label="Contraseña"
            type="password"
            value={pw.password}
            onChange={updatePw('password')}
            error={errors.password}
            placeholder="********"
            autoComplete="new-password"
          />

          <Input
            label="Confirmar contraseña"
            type="password"
            value={pw.confirm_password}
            onChange={updatePw('confirm_password')}
            error={errors.confirm_password}
            placeholder="********"
            autoComplete="new-password"
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Finalizar registro
          </Button>
        </form>
      )}
    </div>
  );
}
