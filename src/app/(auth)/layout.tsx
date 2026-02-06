/**
 * @fileoverview Layout for auth pages — centered card on gradient background.
 * @module app/(auth)/layout
 */
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href={ROUTES.HOME} className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white">
            <Globe className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold text-brand-950">
            Global Solutions Travel
          </span>
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-black/[0.06]">
          {children}
        </div>
      </div>
    </div>
  );
}
