/**
 * @fileoverview Registration form — Email + Password with email confirmation.
 * Uses supabase.auth.signUp() which works with default Supabase config.
 * After signup, user receives confirmation email (magic link from Supabase).
 * Once confirmed, user can login normally.
 * @module components/forms/RegisterForm
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, Mail } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { createClient } from '@/lib/supabase/client';

type Step = 'form' | 'success';

export default function RegisterForm() {
  const supabase = createClient();

  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validations
    if (!fullName.trim() || !email.trim()) {
      setError('Nombre y correo son obligatorios.');
      return;
    }
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'client',
          },
          emailRedirectTo: `${window.location.origin}/login?confirmed=true`,
        },
      });

      if (signUpError) throw signUpError;

      // If user already exists but unconfirmed, Supabase returns user with identities = []
      if (data.user && data.user.identities?.length === 0) {
        setError(
          'Este correo ya está registrado. Revisa tu bandeja de entrada para confirmar tu cuenta, o intenta iniciar sesión.',
        );
        return;
      }

      // Update phone in profile if provided
      if (phone.trim() && data.user) {
        try {
          await supabase
            .from('profiles')
            .update({ phone: phone.trim() })
            .eq('id', data.user.id);
        } catch {
          // Ignore if profile not yet created
        }
      }

      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  }

  /* ── Success screen ── */
  if (step === 'success') {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Mail className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-brand-950">¡Revisa tu correo!</h2>
        <p className="text-neutral-600">
          Hemos enviado un enlace de confirmación a{' '}
          <strong className="text-brand-600">{email}</strong>
        </p>
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold mb-1">📧 Pasos para completar tu registro:</p>
          <ol className="text-left space-y-1 ml-4 list-decimal">
            <li>Abre tu correo electrónico</li>
            <li>Busca el email de <strong>Global Solutions Travel</strong></li>
            <li>
              Haz clic en <strong>&quot;Confirm your mail&quot;</strong>
            </li>
            <li>Vuelve aquí e inicia sesión</li>
          </ol>
        </div>
        <p className="text-xs text-neutral-400">
          ¿No lo ves? Revisa tu carpeta de spam o correo no deseado.
        </p>
        <Link
          href={ROUTES.LOGIN}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Ir a Iniciar Sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

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
        {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
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
