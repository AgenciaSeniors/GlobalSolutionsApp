'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
// ✅ IMPORTACIÓN CORREGIDA: Incluimos ArrowLeft y Lock
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { authService } from '@/services/auth.service';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const confirmed = searchParams.get('confirmed') === 'true';

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        const validation = loginSchema.safeParse(form);
        if (!validation.success) {
          setServerError("Correo o contraseña inválidos");
          setIsLoading(false);
          return;
        }
        await authService.signInStepOne(form.email, form.password);
        setStep('otp'); 
      } else {
        const result = await authService.verifyLoginOtp(form.email, otpCode);
        if (!result.ok) {
          setServerError('Error al verificar el código.');
          return;
        }

        // OTP verified — now we have two paths to establish a session:
        if (result.sessionLink) {
          // Path A: magic link from admin.generateLink — redirects through Supabase
          window.location.href = result.sessionLink;
        } else {
          // Path B: fallback — re-authenticate with password (we know it's valid)
          // This sets the session cookies directly via the browser client
          const supabase = (await import('@/lib/supabase/client')).createClient();
          const { error } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (error) {
            setServerError('Error al iniciar sesión. Intenta de nuevo.');
            return;
          }
          // Redirect to panel which does role-based routing
          window.location.href = '/panel';
        }
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

      {step === 'credentials' ? (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Correo Electrónico</label>
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Contraseña</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
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
            onClick={() => setStep('credentials')} 
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3 w-3" /> {/* 👈 Aquí estaba el error */}
            Volver
          </button>
          
          <div className="text-center bg-brand-50 rounded-xl p-4 border border-brand-100">
            <Lock className="h-5 w-5 text-brand-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">Código enviado a <b>{form.email}</b></p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Código de Verificación</label>
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
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
        ¿No tienes cuenta? <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 underline">Regístrate</Link>
      </p>
      
      <div className="flex items-center justify-center gap-1.5 pt-2 opacity-50">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Secure Auth</span>
      </div>
    </form>
  );
}