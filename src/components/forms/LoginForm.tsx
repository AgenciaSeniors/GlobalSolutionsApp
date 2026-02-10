/**
 * @fileoverview Login form with OTP security factor.
 * @module components/forms/LoginForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { authService } from '@/services/auth.service';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const confirmed = searchParams.get('confirmed') === 'true';

  // Estados del formulario
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  
  // Estados de carga y error
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        // PASO 1: Validar credenciales y disparar OTP
        const result = loginSchema.safeParse(form);
        if (!result.success) {
          const fieldErrors: typeof errors = {};
          result.error.issues.forEach((issue) => {
            const key = issue.path[0] as keyof LoginFormValues;
            fieldErrors[key] = issue.message;
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        setErrors({});
        await authService.signInStepOne(form.email, form.password);
        setStep('otp'); // Saltamos al campo del código
      } else {
        // PASO 2: Verificar el código de 6 dígitos
        await authService.verifyLoginOtp(form.email, otpCode);
        
        // Si todo sale bien, redirigimos
        router.push(redirect || '/dashboard');
      }
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Error en la autenticación',
      );
    } finally {
      setIsLoading(false);
    }
  }

  const update = (field: keyof LoginFormValues) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Notificaciones de estado */}
      {confirmed && !serverError && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
          ✅ <strong>¡Correo confirmado!</strong> Ahora puedes iniciar sesión.
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {serverError}
        </div>
      )}

      {/* Renderizado condicional según el paso */}
      {step === 'credentials' ? (
        <>
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
        </>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <button 
            type="button" 
            onClick={() => setStep('credentials')}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3 w-3" /> Volver a contraseña
          </button>
          
          <div className="text-center pb-2">
            <p className="text-sm text-neutral-600">
              Hemos enviado un código de seguridad a: <br/>
              <span className="font-semibold text-neutral-900">{form.email}</span>
            </p>
          </div>

          <Input
            label="Código de 6 dígitos"
            type="text"
            placeholder="000000"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            required
            className="text-center text-2xl tracking-widest"
          />
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {step === 'credentials' ? 'Continuar' : 'Verificar e Ingresar'}
      </Button>

      <p className="text-center text-sm text-neutral-600">
        ¿No tienes cuenta?{' '}
        <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 hover:underline">
          Regístrate
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Seguridad de nivel bancario · AES-256
      </p>
    </form>
  );
}