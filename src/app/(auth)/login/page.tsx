/**
 * @fileoverview Login page.
 * @module app/(auth)/login/page
 */
import type { Metadata } from 'next';
import LoginForm from '@/components/forms/LoginForm';

export const metadata: Metadata = { title: 'Iniciar Sesión' };

export default function LoginPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-950">Bienvenido</h1>
        <p className="mt-1 text-sm text-neutral-500">Inicia sesión en tu cuenta</p>
      </div>
      <LoginForm />
    </>
  );
}
