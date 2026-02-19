import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-6 py-20">
          <Card variant="elevated" className="w-full text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-500">404</p>
            <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
              Página no encontrada
            </h1>
            <p className="mt-3 text-neutral-600">
              El enlace puede estar roto o la página fue movida.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={ROUTES.HOME}>
                <Button>Ir al inicio</Button>
              </Link>
              <Link href={ROUTES.OFFERS}>
                <Button variant="outline">Ver ofertas</Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
