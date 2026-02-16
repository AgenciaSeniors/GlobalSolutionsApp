/**
 * @fileoverview Landing page — assembles Hero, TrustBanner, FlightSearch,
 *               Exclusive Offers and Reviews sections.
 * If user is authenticated, redirects to /panel.
 * @module app/page
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/features/home/HeroSection';
import TrustBanner from '@/components/features/home/TrustBanner';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import ExclusiveOfferCard from '@/components/features/flights/ExclusiveOfferCard';
import ReviewCard from '@/components/features/reviews/ReviewCard';

/* ── Static data (replaced by Supabase queries in production) ── */
const OFFERS = [
  {
    destination: 'Estambul, Turquía',
    route: 'HAV → IST',
    airline: 'Turkish Airlines',
    duration: '14h 30m',
    originalPrice: 1250,
    offerPrice: 849,
    availableSeats: 3,
    gradient: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800',
  },
  {
    destination: 'Madrid, España',
    route: 'HAV → MAD',
    airline: 'Iberia',
    duration: '9h 15m',
    originalPrice: 980,
    offerPrice: 699,
    availableSeats: 7,
    gradient: 'bg-gradient-to-br from-orange-500 via-red-600 to-rose-700',
  },
  {
    destination: 'Cancún, México',
    route: 'HAV → CUN',
    airline: 'Viva Aerobus',
    duration: '2h 45m',
    originalPrice: 450,
    offerPrice: 299,
    availableSeats: 12,
    gradient: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
  },
  {
    destination: 'Panamá City',
    route: 'HAV → PTY',
    airline: 'Copa Airlines',
    duration: '3h 30m',
    originalPrice: 620,
    offerPrice: 449,
    availableSeats: 5,
    gradient: 'bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-600',
  },
];

const REVIEWS = [
  {
    authorName: 'María García',
    authorInitials: 'MG',
    destination: 'Estambul',
    date: 'Ene 2026',
    rating: 5,
    comment:
      'Increíble experiencia. El equipo de Global Solutions fue excepcional en todo momento. Vuelos puntuales y precios inmejorables.',
  },
  {
    authorName: 'Carlos Rodríguez',
    authorInitials: 'CR',
    destination: 'Madrid',
    date: 'Dic 2025',
    rating: 5,
    comment:
      'Tercer viaje con ellos y siempre impecable. La atención personalizada marca la diferencia. 100% recomendado.',
  },
  {
    authorName: 'Ana Martínez',
    authorInitials: 'AM',
    destination: 'Cancún',
    date: 'Nov 2025',
    rating: 4,
    comment:
      'Muy buena experiencia. Precios competitivos y el proceso de reserva fue muy sencillo. Volveré a usar sus servicios.',
  },
];

export default async function HomePage() {
  // ✅ Si ya hay sesión, entramos directo al “home real” (panel)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/panel');
  }

  // ✅ Si no hay sesión, mostramos el landing público
  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Flight Search ── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
              Búsqueda de Vuelos
            </span>
            <h2 className="mt-2 font-display text-4xl font-bold text-brand-950">
              Encuentra tu vuelo ideal
            </h2>
          </div>
          <FlightSearchForm />
        </div>
      </section>

      {/* ── Exclusive Offers ── */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
              🔥 Ofertas Exclusivas
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold text-brand-950">
              Destinos imperdibles
            </h2>
            <p className="mt-2 text-neutral-600">
              Precios especiales por tiempo limitado. ¡No te los pierdas!
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERS.map((o) => (
              <ExclusiveOfferCard key={o.destination} {...o} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <TrustBanner />

      {/* ── Reviews ── */}
      <section className="bg-gradient-to-b from-neutral-50 to-brand-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">
              Reseñas Verificadas
            </span>
            <h2 className="mt-2 font-display text-4xl font-bold text-brand-950">
              Lo que dicen nuestros viajeros
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <ReviewCard key={r.authorName} {...r} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
