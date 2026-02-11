'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { authService } from '@/services/auth.service';

export default function LoginForm() {
  // Estados de flujo
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Datos del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const otpDigits = useMemo(() => otpCode.replace(/\D/g, '').slice(0, 6), [otpCode]);
  const canSubmit =
    step === 'credentials'
      ? email.trim().length > 0 && password.length > 0
      : email.trim().length > 0 && otpDigits.length === 6;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        // PASO 1: Validar correo/contraseña y pedir el código
        await authService.signInStepOne(email, password);
        setStep('otp');
      } else {
        // PASO 2: Verificar el código y obtener la sesión definitiva
        const result = await authService.verifyLoginOtp(email, otpDigits);

        if (result?.ok && typeof result.sessionLink === 'string' && result.sessionLink.trim()) {
          // Redirigimos al link de sesión para que Supabase guarde las cookies
          window.location.href = result.sessionLink;
          return;
        }

        // Si el backend solo devuelve verified (compat), mostramos error claro:
        setServerError('No se pudo establecer la sesión. Intenta de nuevo.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al intentar iniciar sesión';
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-brand-950">
          {step === 'credentials' ? 'Bienvenido de nuevo' : 'Verificación de Seguridad'}
        </h1>
        <p className="text-neutral-600 text-sm">
          {step === 'credentials'
            ? 'Ingresa tus credenciales para acceder'
            : 'Introduce el código de 6 dígitos enviado a tu correo'}
        </p>
      </div>

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{serverError}</div>
      )}

      {step === 'credentials' ? (
        <>
          <Input
            id="email"
            label="Correo Electrónico"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
          <Input
            id="password"
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setOtpCode('');
              setServerError(null);
            }}
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
            disabled={isLoading}
          >
            <ArrowLeft className="h-3 w-3" /> Cambiar correo o contraseña
          </button>

          <Input
            id="otp"
            label="Código de Seguridad"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={otpDigits}
            onChange={(e) => setOtpCode(e.target.value)}
            required
            disabled={isLoading}
            className="text-center text-2xl tracking-[0.5em] font-mono"
          />
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full" disabled={!canSubmit}>
        {step === 'credentials' ? 'Continuar' : 'Verificar e Ingresar'}
      </Button>

      {step === 'credentials' && (
        <p className="text-center text-sm text-neutral-600">
          ¿No tienes cuenta?{' '}
          <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 hover:underline">
            Regístrate
          </Link>
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Autenticación de dos factores activa
      </p>
    </form>
  );
}
