import Link from 'next/link';
import { ArrowRight, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

export default function HomeCtaSection() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-indigo-900 to-brand-700 p-10 text-white shadow-xl">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest">
              <Shield className="h-4 w-4" /> Compra segura
            </span>

            <h2 className="mt-4 font-display text-4xl font-bold">
              ¿Listo para tu próximo viaje?
            </h2>

            <p className="mt-3 max-w-2xl text-white/80">
              Explora ofertas, encuentra vuelos y si necesitas algo especial, te cotizamos rápido.
            </p>

            <div className="mt-7 flex flex-wrap gap-4">
              <Link href={ROUTES.OFFERS}>
                <Button size="lg" className="gap-2">
                  Ver Ofertas <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={ROUTES.FLIGHTS}>
                <Button variant="outline" size="lg" className="bg-white/10 text-white hover:bg-white/15">
                  Buscar Vuelos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
