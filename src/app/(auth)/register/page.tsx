/**
 * @fileoverview Registration page.
 * @module app/(auth)/register/page
 */
import type { Metadata } from 'next';
import RegisterForm from '@/components/forms/RegisterForm';

export const metadata: Metadata = { title: 'Crear Cuenta' };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-950">Crear Cuenta</h1>
        <p className="mt-1 text-sm text-neutral-500">Regístrate para comenzar a viajar</p>
      </div>
      <RegisterForm />
    </>
  );
}
