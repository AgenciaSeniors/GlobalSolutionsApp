/**
 * @fileoverview Animated hero section with headline, CTAs and trust stats.
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
  className="relative flex min-h-[80vh] items-center justify-center bg-cover bg-center pt-20"
  style={{ backgroundImage: "url('/home/hero.png')" }}
>

  {/* Overlay oscuro */}
  <div className="absolute inset-0 bg-black/50" />

  {/* Contenido */}
  <div className="relative z-10 max-w-3xl px-6 text-center text-white">
    <h1 className="mb-6 font-heading text-4xl font-bold md:text-6xl">
      Descubre el mundo con Global Solutions Travel
    </h1>

    <p className="mb-8 text-lg md:text-xl">
      Vuelos, experiencias y destinos pensados para ti
    </p>

    <button className="rounded-md bg-coral px-8 py-4 font-semibold text-white hover:brightness-95">
      <Link href={ROUTES.FLIGHTS}>Reserva Ahora</Link>
    </button>
  </div>
</section>

  );
}
