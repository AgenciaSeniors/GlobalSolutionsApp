/**
 * @fileoverview Landing page — assembles Hero, TrustBanner, FlightSearch,
 *               Exclusive Offers and Reviews sections.
 *               Visible for ALL users (authenticated or not).
 *               Authenticated users see "Mi Panel" in the navbar.
 * @module app/page
 */
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/features/home/HeroSection';
import TrustBanner from '@/components/features/home/TrustBanner';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import ExclusiveOfferCard from '@/components/features/flights/ExclusiveOfferCard';
import ReviewCard from '@/components/features/reviews/ReviewCard';

/* -- Static data (replaced by Supabase queries in production) -- */
const OFFERS = [
  {
    destination: 'Estambul, Turqu\u00eda',
    route: 'HAV \u2192 IST',
    airline: 'Turkish Airlines',
    duration: '14h 30m',
    originalPrice: 1250,
    offerPrice: 849,
    availableSeats: 3,
    gradient: 'bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800',
  },
  {
    destination: 'Madrid, Espa\u00f1a',
    route: 'HAV \u2192 MAD',
    airline: 'Iberia',
    duration: '9h 15m',
    originalPrice: 980,
    offerPrice: 699,
    availableSeats: 7,
    gradient: 'bg-gradient-to-br from-orange-500 via-red-600 to-rose-700',
  },
  {
    destination: 'Canc\u00fan, M\u00e9xico',
    route: 'HAV \u2192 CUN',
    airline: 'Viva Aerobus',
    duration: '2h 45m',
    originalPrice: 450,
    offerPrice: 299,
    availableSeats: 12,
    gradient: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
  },
  {
    destination: 'Panam\u00e1 City',
    route: 'HAV \u2192 PTY',
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
    authorName: 'Mar\u00eda Garc\u00eda',
    authorInitials: 'MG',
    destination: 'Estambul',
    date: 'Ene 2026',
    rating: 5,
    comment:
      'Incre\u00edble experiencia. El equipo de Global Solutions fue excepcional en todo momento. Vuelos puntuales y precios inmejorables.',
  },
  {
    authorName: 'Carlos Rodr\u00edguez',
    authorInitials: 'CR',
    destination: 'Madrid',
    date: 'Dic 2025',
    rating: 5,
    comment:
      'Tercer viaje con ellos y siempre impecable. La atenci\u00f3n personalizada marca la diferencia. 100% recomendado.',
  },
  {
    authorName: 'Ana Mart\u00ednez',
    authorInitials: 'AM',
    destination: 'Canc\u00fan',
    date: 'Nov 2025',
    rating: 4,
    comment:
      'Muy buena experiencia. Precios competitivos y el proceso de reserva fue muy sencillo. Volver\u00e9 a usar sus servicios.',
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* -- Hero -- */}
      <HeroSection />

      {/* -- Flight Search -- */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
              B\u00fasqueda de Vuelos
            </span>
            <h2 className="mt-2 font-display text-4xl font-bold text-brand-950">
              Encuentra tu vuelo ideal
            </h2>
          </div>
          <FlightSearchForm />
        </div>
      </section>

      {/* -- Exclusive Offers -- */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
              {'\uD83D\uDD25'} Ofertas Exclusivas
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold text-brand-950">
              Destinos imperdibles
            </h2>
            <p className="mt-2 text-neutral-600">
              Precios especiales por tiempo limitado. {'\u00a1'}No te los pierdas!
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERS.map((o) => (
              <ExclusiveOfferCard key={o.destination} {...o} />
            ))}
          </div>
        </div>
      </section>

      {/* -- Trust -- */}
      <TrustBanner />

      {/* -- Reviews -- */}
      <section className="bg-gradient-to-b from-neutral-50 to-brand-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">
              Rese\u00f1as Verificadas
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
