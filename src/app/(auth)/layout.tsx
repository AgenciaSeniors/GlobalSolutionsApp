/**
 * @fileoverview Layout for auth pages — centered card on gradient background.
 * @module app/(auth)/layout
 */
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-12">
      <div className="w-full max-w-md">
       
       

        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-black/[0.06]">
          {children}
        </div>
      </div>
    </div>
  );
}
