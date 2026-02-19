'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-6 py-20">
          <Card variant="elevated" className="w-full text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Error</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
              Algo salió mal
            </h1>
            <p className="mt-3 text-neutral-600">
              Intenta recargar. Si el problema persiste, vuelve al inicio.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button onClick={reset}>Reintentar</Button>
              <Link href={ROUTES.HOME}>
                <Button variant="outline">Ir al inicio</Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
