/**
 * @fileoverview Client registration form with 3-step OTP hybrid flow.
 *
 *   Step 1 → Enter email → request OTP
 *   Step 2 → Enter 6-digit code → verify OTP
 *   Step 3 → Enter name + password → complete registration
 *
 * @module components/forms/RegisterForm
 */
'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, Mail, KeyRound, UserPlus, ArrowLeft, Loader2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

type Step = 'email' | 'otp' | 'complete';

export default function RegisterForm() {
  const { requestOtp, verifyOtp, completeRegister, isLoading } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* ── Cooldown timer for resend ── */
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ── OTP input handlers ── */
  function handleOtpChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  const otpCode = otpDigits.join('');

  /* ── STEP 1: Request OTP ── */
  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!email || !email.includes('@')) {
      setServerError('Ingresa un correo electrónico válido');
      return;
    }

    try {
      await requestOtp({ email });
      setCooldown(60);
      setStep('otp');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al enviar el código');
    }
  }

  /* ── Resend OTP ── */
  async function handleResend() {
    setServerError(null);
    try {
      await requestOtp({ email });
      setCooldown(60);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al reenviar');
    }
  }

  /* ── STEP 2: Verify OTP ── */
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (otpCode.length !== 6) {
      setServerError('Ingresa los 6 dígitos del código');
      return;
    }

    try {
      await verifyOtp({ email, code: otpCode });
      setStep('complete');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Código inválido');
    }
  }

  /* ── STEP 3: Complete Registration ── */
  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!fullName || fullName.trim().length < 2) {
      setServerError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (password.length < 8) {
      setServerError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setServerError('La contraseña debe contener al menos una mayúscula');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setServerError('La contraseña debe contener al menos un número');
      return;
    }
    if (password !== confirmPassword) {
      setServerError('Las contraseñas no coinciden');
      return;
    }

    try {
      await completeRegister({ email, fullName, password });
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Error al registrarse');
    }
  }

  /* ── Step indicator ── */
  const steps = [
    { key: 'email', label: 'Correo', icon: Mail },
    { key: 'otp', label: 'Verificar', icon: KeyRound },
    { key: 'complete', label: 'Completar', icon: UserPlus },
  ] as const;

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* ── Step Progress ── */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {isDone ? '✓' : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    isActive ? 'text-brand-600' : isDone ? 'text-emerald-600' : 'text-neutral-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded transition-colors ${
                    isDone ? 'bg-emerald-300' : 'bg-neutral-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Error banner ── */}
      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-accent-red" role="alert">
          {serverError}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  STEP 1 — Email                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 'email' && (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <div>
            <p className="text-sm text-neutral-600">
              Ingresa tu correo electrónico y te enviaremos un código de 6 dígitos para verificar tu identidad.
            </p>
          </div>

          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  STEP 2 — OTP Verification                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <p className="text-sm text-neutral-600">
              Enviamos un código de 6 dígitos a{' '}
              <span className="font-semibold text-neutral-900">{email}</span>
            </p>
          </div>

          {/* 6-digit OTP inputs */}
          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={`h-14 w-12 rounded-xl border-2 bg-neutral-50 text-center text-xl font-bold transition-colors
                  focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20
                  ${digit ? 'border-brand-300 text-neutral-900' : 'border-neutral-200 text-neutral-400'}`}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {/* Resend */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-sm text-neutral-400">
                Reenviar código en <span className="font-semibold text-neutral-600">{cooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm font-semibold text-brand-600 hover:underline disabled:opacity-50"
              >
                Reenviar código
              </button>
            )}
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full">
            Verificar Código
          </Button>

          {/* Back */}
          <button
            type="button"
            onClick={() => { setStep('email'); setServerError(null); setOtpDigits(['', '', '', '', '', '']); }}
            className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar correo
          </button>
        </form>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  STEP 3 — Complete Registration                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 'complete' && (
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              ✓ Correo verificado
            </div>
            <p className="text-sm text-neutral-600">
              Completa tu perfil para finalizar el registro.
            </p>
          </div>

          <Input
            label="Nombre Completo"
            placeholder="María García"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            placeholder="Repetir contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" isLoading={isLoading} className="w-full">
            Crear Cuenta
          </Button>
        </form>
      )}

      {/* ── Footer ── */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <Shield className="h-3 w-3" />
        Conexión segura · Datos encriptados con AES-256
      </p>
    </div>
  );
}