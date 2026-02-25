// src/components/forms/LoginForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { authService } from '@/services/auth.service';
import { Capacitor } from '@capacitor/core';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const confirmed = searchParams.get('confirmed') === 'true';

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  async function handleGoogleSignIn() {
    setServerError(null);
    setIsLoading(true);
    try {
      // Import dinámico para no romper el bundle web (el plugin no existe en web)
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser.authentication.idToken;

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw new Error(error.message);
      // Sesión establecida directamente, sin redirect a supabase.co
      window.location.href = '/';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error con Google Sign-In';
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        const validation = loginSchema.safeParse(form);
        if (!validation.success) {
          setServerError('Correo o contraseña inválidos');
          return;
        }

        const result = await authService.signInStepOne(form.email, form.password);

        // 🔧 Si ya estaba autenticado o dispositivo confiable, ir al home público
        if (
          result.message === 'ALREADY_AUTHENTICATED' ||
          result.message === 'SIGNED_IN_TRUSTED_DEVICE'
        ) {
          window.location.href = '/';
          return;
        }

        // OTP fue enviado — mostrar paso 2
        setStep('otp');
        return;
      }

      // ─── PASO 2: Verificar OTP ───
      if (otpCode.trim().length !== 6) {
        setServerError('Ingresa un código de 6 dígitos.');
        return;
      }

      const result = await authService.verifyLoginOtp(form.email, otpCode.trim());

      if ('sessionLink' in result && result.sessionLink) {
        // Web: navegar al magic link para que /auth/callback establezca la sesión
        window.location.href = result.sessionLink;
      } else {
        // App nativa: setSession ya se hizo en auth.service.ts, solo redirigir
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error en la autenticación';
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {confirmed && !serverError && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
          ✅ Correo confirmado. Ya puedes ingresar.
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 border border-red-100">
          {serverError}
        </div>
      )}

      {/* Botón de Google: solo visible en app nativa (Capacitor), no en web */}
      {isNative && step === 'credentials' && (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            isLoading={isLoading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-neutral-200" />
            <span className="text-xs text-neutral-400">o con correo</span>
            <div className="flex-1 border-t border-neutral-200" />
          </div>
        </div>
      )}

      {step === 'credentials' ? (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Correo Electrónico</label>
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Contraseña</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-600">Mantener sesión activa</span>
            </label>
            <Link href={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-brand-600">
              ¿Olvidaste tu clave?
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setOtpCode('');
              setServerError(null);
            }}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </button>

          <div className="text-center bg-brand-50 rounded-xl p-4 border border-brand-100">
            <Lock className="h-5 w-5 text-brand-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">
              Código enviado a <b>{form.email}</b>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Código de Verificación</label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                // Solo permitir dígitos
                const value = e.target.value.replace(/\D/g, '');
                setOtpCode(value);
              }}
              required
              className="text-center text-2xl tracking-[0.4em] font-mono"
            />
          </div>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {step === 'credentials' ? 'Continuar' : 'Verificar e Ingresar'}
      </Button>

      <p className="text-center text-sm text-neutral-600">
        ¿No tienes cuenta?{' '}
        <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 underline">
          Regístrate
        </Link>
      </p>

      <div className="flex items-center justify-center gap-1.5 pt-2 opacity-50">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Secure Auth</span>
      </div>
    </form>
  );
}
