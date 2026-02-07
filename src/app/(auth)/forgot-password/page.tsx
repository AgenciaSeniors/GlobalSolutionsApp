/**
 * @fileoverview Forgot Password flow per spec §2.4.
 * Sends OTP for password reset.
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';
import { KeyRound, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { resetPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar enlace');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6">
      <div className="w-full max-w-md">
        {sent ? (
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
            <h1 className="text-2xl font-bold">¡Enlace Enviado!</h1>
            <p className="mt-2 text-neutral-600">
              Revisa tu correo <strong>{email}</strong> para restablecer tu contraseña.
            </p>
            <Link href={ROUTES.LOGIN} className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Volver al Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <KeyRound className="mx-auto mb-3 h-10 w-10 text-brand-600" />
              <h1 className="text-2xl font-bold">¿Olvidaste tu contraseña?</h1>
              <p className="mt-1 text-sm text-neutral-500">Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
            </div>
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Correo Electrónico" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
              <Button type="submit" isLoading={isLoading} className="w-full">Enviar Enlace</Button>
            </form>
            <p className="mt-4 text-center text-sm text-neutral-600">
              <Link href={ROUTES.LOGIN} className="font-semibold text-brand-600 hover:underline">Volver al Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
