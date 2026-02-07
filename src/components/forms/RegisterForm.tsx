/**
 * @fileoverview Hybrid registration: Email → OTP verify → Create password.
 * Per spec §1.1: "Auth Híbrido (OTP + Contraseña)"
 * Step 1: User enters email
 * Step 2: System sends 6-digit OTP → user verifies
 * Step 3: User creates secure password → account created
 * @module components/forms/RegisterForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, Mail, Key, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { createClient } from '@/lib/supabase/client';
import type { OTPStep } from '@/types/models';

export default function RegisterForm() {
  const supabase = createClient();

  const [step, setStep] = useState<OTPStep>('email');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ── Step 1: Send OTP to email ── */
  async function handleSendOTP(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !fullName.trim()) {
      setError('Nombre y correo son obligatorios.');
      return;
    }

    setIsLoading(true);
    try {
      // Use Supabase OTP (magic link / email code)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName.trim(), role: 'client' },
        },
      });

      if (otpError) throw otpError;
      setStep('verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar código');
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Step 2: Verify OTP code ── */
  async function handleVerifyOTP(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Ingresa el código de 6 dígitos.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (verifyError) throw verifyError;
      setStep('password');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado');
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Step 3: Set password ── */
  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      // User is already authenticated via OTP — update their password
      const { error: pwError } = await supabase.auth.updateUser({
        password,
      });

      if (pwError) throw pwError;

      // Update profile with phone
      if (phone.trim()) {
        await supabase.from('profiles').update({ phone: phone.trim() })
          .eq('email', email);
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear contraseña');
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="text-2xl font-bold text-brand-950">¡Cuenta Creada!</h2>
        <p className="text-neutral-600">
          Tu cuenta ha sido verificada y tu contraseña establecida.
        </p>
        <Link
          href={ROUTES.USER_DASHBOARD}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Ir a Mi Panel
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {(['email', 'verify', 'password'] as OTPStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
              step === s ? 'bg-brand-600 text-white' :
              (['email', 'verify', 'password'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
              'bg-neutral-200 text-neutral-500'
            }`}>
              {(['email', 'verify', 'password'].indexOf(step) > i) ? '✓' : i + 1}
            </div>
            {i < 2 && <div className={`h-0.5 w-8 ${(['email', 'verify', 'password'].indexOf(step) > i) ? 'bg-emerald-500' : 'bg-neutral-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600" role="alert">
          {error}
        </div>
      )}

      {/* ── Step 1: Email + Name ── */}
      {step === 'email' && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div className="text-center mb-2">
            <Mail className="mx-auto h-10 w-10 text-brand-500 mb-2" />
            <h3 className="font-bold text-lg">Paso 1: Tu información</h3>
            <p className="text-sm text-neutral-500">Te enviaremos un código de verificación</p>
          </div>

          <Input
            label="Nombre Completo"
            placeholder="María García"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
          />

          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <Input
            label="Teléfono (opcional)"
            type="tel"
            placeholder="+53 5555 5555"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Enviar Código de Verificación
          </Button>

          <p className="text-center text-sm text-neutral-600">
            ¿Ya tienes cuenta?{' '}
            <Link href={ROUTES.LOGIN} className="font-semibold text-brand-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      )}

      {/* ── Step 2: OTP Verification ── */}
      {step === 'verify' && (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="text-center mb-2">
            <Key className="mx-auto h-10 w-10 text-amber-500 mb-2" />
            <h3 className="font-bold text-lg">Paso 2: Verificar correo</h3>
            <p className="text-sm text-neutral-500">
              Ingresa el código de 6 dígitos enviado a <strong>{email}</strong>
            </p>
          </div>

          <Input
            label="Código de Verificación (6 dígitos)"
            placeholder="123456"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-2xl tracking-[0.5em] font-mono"
            required
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Verificar Código
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="flex items-center gap-1 text-neutral-500 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Cambiar email
            </button>
            <button
              type="button"
              onClick={() => handleSendOTP({ preventDefault: () => {} } as FormEvent)}
              className="text-brand-600 hover:underline"
            >
              Reenviar código
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: Create Password ── */}
      {step === 'password' && (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="text-center mb-2">
            <Lock className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
            <h3 className="font-bold text-lg">Paso 3: Crear contraseña</h3>
            <p className="text-sm text-neutral-500">Email verificado ✓ — ahora crea tu contraseña</p>
          </div>

          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            placeholder="Repetir contraseña"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Crear Cuenta
          </Button>
        </form>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Conexión segura · Datos encriptados con AES-256
      </p>
    </div>
  );
}
