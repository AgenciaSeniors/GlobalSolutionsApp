/**
 * @fileoverview Client registration form (OTP 6 dígitos + contraseña).
 *              NO usa Supabase signInWithOtp; el OTP lo envía nuestro backend.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { completeRegister, requestOtp, verifyOtp } from '@/services/otp.service';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Step = 'request' | 'verify' | 'password';

type FormFields = {
  full_name: string;
  email: string;
  phone: string;
  code: string;
  password: string;
  confirm_password: string;
};

export default function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('request');
  const [form, setForm] = useState<FormFields>({
    full_name: '',
    email: '',
    phone: '',
    code: '',
    password: '',
    confirm_password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const update = (field: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((prev) => ({ ...prev, [field]: v }));
  };

  async function onRequestOtp() {
    setServerError(null);

    const email = form.email.trim();
    if (!email) return setServerError('Correo requerido.');

    if (cooldown > 0) return;

    setIsLoading(true);
    try {
      await requestOtp(email);
      setCooldown(60);
      setStep('verify');
    } catch (err: any) {
      setServerError(err?.message ?? 'Error al enviar código');
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifyOtp() {
    setServerError(null);

    const email = form.email.trim();
    const code = form.code.trim();

    if (!/^[0-9]{6}$/.test(code)) {
      return setServerError('El código debe ser de 6 dígitos.');
    }

    setIsLoading(true);
    try {
      await verifyOtp(email, code);
      setStep('password');
    } catch (err: any) {
      setServerError(err?.message ?? 'Error al verificar código');
    } finally {
      setIsLoading(false);
    }
  }

  async function onCompleteRegister() {
    setServerError(null);

    const email = form.email.trim();
    const fullName = form.full_name.trim();

    if (!fullName) return setServerError('Nombre requerido.');

    if (form.password.length < 8) {
      return setServerError('La contraseña debe tener al menos 8 caracteres.');
    }
    if (form.password !== form.confirm_password) {
      return setServerError('Las contraseñas no coinciden.');
    }

    setIsLoading(true);
    try {
      await completeRegister(email, fullName, form.password);

      // login automático
      const { error } = await supabase.auth.signInWithPassword({ email, password: form.password });
      if (error) throw error;

      router.push(ROUTES.USER_DASHBOARD);
    } catch (err: any) {
      setServerError(err?.message ?? 'Error al completar registro');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {serverError}
        </div>
      )}

      {step === 'request' && (
        <>
          <Input
            label="Nombre Completo"
            placeholder="María García"
            value={form.full_name}
            onChange={update('full_name')}
            required
          />

          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="correo@ejemplo.com"
            value={form.email}
            onChange={update('email')}
            required
          />

          <Input
            label="Teléfono (opcional)"
            type="tel"
            placeholder="+53 5555 5555"
            value={form.phone}
            onChange={update('phone')}
          />

          <Button onClick={onRequestOtp} isLoading={isLoading} className="w-full" disabled={cooldown > 0}>
            {cooldown > 0 ? `Reintenta en ${cooldown}s` : 'Enviar código (6 dígitos)'}
          </Button>
        </>
      )}

      {step === 'verify' && (
        <>
          <Input
            label="Código (6 dígitos)"
            placeholder="123456"
            value={form.code}
            onChange={(e) => {
              const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 6);
              setForm((prev) => ({ ...prev, code: onlyDigits }));
            }}
            required
          />

          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={() => setStep('request')} disabled={isLoading}>
              Cambiar email
            </Button>
            <Button className="w-full" onClick={onVerifyOtp} isLoading={isLoading}>
              Verificar
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onRequestOtp}
            disabled={isLoading || cooldown > 0}
          >
            {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
          </Button>
        </>
      )}

      {step === 'password' && (
        <>
          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={update('password')}
            required
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            placeholder="Repetir contraseña"
            value={form.confirm_password}
            onChange={update('confirm_password')}
            required
          />

          <Button onClick={onCompleteRegister} isLoading={isLoading} className="w-full">
            Finalizar registro
          </Button>
        </>
      )}

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
    </div>
  );
}
