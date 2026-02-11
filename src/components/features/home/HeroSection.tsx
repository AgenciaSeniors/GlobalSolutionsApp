/**
 * @fileoverview Hero section (branding background) with CTAs + trust + stats.
 * @module components/features/home/HeroSection
 */
import Link from 'next/link';
import { Plane, Car, ArrowRight, Shield } from 'lucide-react';
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
      className="relative flex min-h-[80vh] items-center bg-cover bg-center pt-20"
      style={{ backgroundImage: "url('/home/hero.png')" }}
    >
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Watermark sutil (no depende de animaciones custom) */}
      <Plane className="pointer-events-none absolute right-[10%] top-[18%] hidden h-44 w-44 -rotate-12 text-white/10 md:block" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 pt-12 lg:pt-16">
        <div className="max-w-2xl text-white">
          {/* Trust pill */}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-white backdrop-blur">
            <Shield className="h-3.5 w-3.5" />
            Agencia Verificada · +5,000 viajeros satisfechos
          </span>

          {/* Headline */}
          <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Descubre el mundo con{' '}
            <span className="text-brand-200">Global Solutions Travel</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85 md:text-xl">
            Vuelos, experiencias y destinos pensados para ti. Seguridad, soporte y ofertas
            exclusivas en un solo lugar.
          </p>

          {/* CTA row */}
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href={ROUTES.FLIGHTS}>
              <Button size="lg" className="gap-2.5">
                <Plane className="h-5 w-5" />
                Buscar Vuelos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link href={ROUTES.CARS}>
              <Button variant="outline" size="lg" className="gap-2.5 bg-white/10 text-white hover:bg-white/15">
                <Car className="h-5 w-5" />
                Rentar Auto
              </Button>
            </Link>
          </div>

          {/* Secondary CTA (branding original) */}
          <div className="mt-4">
            <Link href={ROUTES.FLIGHTS}>
              <Button variant="ghost" className="text-white/90 hover:text-white">
                Reserva Ahora
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
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
