/**
 * @fileoverview Hero section (branding background) with CTAs + trust + stats.
 * @module components/features/home/HeroSection
 */
import Link from 'next/link';
import { Plane, Car, Shield } from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';
import Button from '@/components/ui/Button';

const STATS = [
  { value: '15+', label: 'Aerolíneas' },
  { value: '50+', label: 'Destinos' },
  { value: '24/7', label: 'Soporte' },
  { value: '98%', label: 'Satisfacción' },
];

export default function HeroSection() {
  return (
    <section
      className="relative isolate flex min-h-[72vh] items-center overflow-hidden bg-cover bg-center pt-24"
      style={{ backgroundImage: "url('/home/hero.png')" }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-6 pb-20">
        <div className="flex max-w-3xl flex-col items-center text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur">
            <Shield className="h-4 w-4" />
            Agencia Verificada · +5,000 viajeros satisfechos
          </span>

          <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Descubre el mundo con{' '}
            <span className="text-brand-200">Global Solutions Travel</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg md:text-xl">
            Vuelos, experiencias y destinos pensados para ti. Seguridad, soporte y ofertas
            exclusivas en un solo lugar.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link href={ROUTES.FLIGHTS}>
              <Button size="lg" className="gap-2.5">
                <Plane className="h-5 w-5" />
                Buscar Vuelos
              </Button>
            </Link>

            <Link href={ROUTES.CARS}>
              <Button variant="outline" size="lg" className="gap-2.5 bg-white/10 text-white hover:bg-white/15">
                <Car className="h-5 w-5" />
                Rentar Auto
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
              >
                <div className="text-2xl font-extrabold text-white">{s.value}</div>
                <div className="mt-1 text-sm font-medium text-white/80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
