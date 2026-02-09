/**
 * @fileoverview Animated hero section with headline, CTAs and trust stats.
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
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f8faff] via-brand-50 to-brand-100">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute right-[5%] top-[10%] h-[400px] w-[400px] rounded-full bg-brand-500/[0.06] blur-3xl animate-float" />
      <div className="pointer-events-none absolute bottom-[15%] left-[8%] h-[250px] w-[250px] rounded-full bg-indigo-500/[0.05] blur-2xl animate-float [animation-delay:2s]" />

      {/* Floating plane watermark */}
      <Plane className="pointer-events-none absolute right-[12%] top-[18%] h-48 w-48 -rotate-12 text-brand-900/[0.06] animate-float" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-32 lg:pt-40">
        <div className="max-w-2xl">
          {/* Trust pill */}
          <span className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[13px] font-semibold text-emerald-700">
            <Shield className="h-3.5 w-3.5" />
            Agencia Verificada · +5,000 viajeros satisfechos
          </span>

          {/* Headline */}
          <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-brand-950 animate-fade-in-up [animation-delay:100ms] opacity-0">
            Tu próxima{' '}
            <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 bg-clip-text text-transparent">
              aventura
            </span>
            <br />
            comienza aquí
          </h1>

          {/* Subtitle */}
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600 animate-fade-in-up [animation-delay:200ms] opacity-0">
            Vuelos internacionales y renta de autos con los mejores precios del
            mercado. Seguridad bancaria, atención personalizada y ofertas
            exclusivas.
          </p>

          {/* CTA row */}
          <div className="mt-9 flex flex-wrap gap-4 animate-fade-in-up [animation-delay:300ms] opacity-0">
            <Link href={ROUTES.FLIGHTS}>
              <Button size="lg" className="gap-2.5 animate-pulse-glow">
                <Plane className="h-5 w-5" />
               
                Buscar Vuelos
              </Button>
            </Link>
            <Link href={ROUTES.CARS}>
              <Button variant="outline" size="lg" className="gap-2.5">
                <Car className="h-5 w-5" />
                Rentar Auto
              </Button>
            </Link>
          </div>
        


          {/* Stats */}
          <div className="mt-14 flex flex-wrap gap-10 animate-fade-in-up [animation-delay:400ms] opacity-0">
            {STATS.map((s) => (
              <div key={s.label}>
                <span className="font-display text-3xl font-extrabold text-brand-700">
                  {s.value}
                </span>
                <span className="mt-0.5 block text-sm font-medium text-neutral-500">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
