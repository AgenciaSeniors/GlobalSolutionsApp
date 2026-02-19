/**
 * @fileoverview Landing page — Hero, FlightSearch, Offers Carousel,
 *               Trust, About, Services, Reviews and CTA.
 * @module app/page
 */
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/features/home/HeroSection';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import ReviewCard from '@/components/features/reviews/ReviewCard';
import AboutSection from '@/components/features/home/AboutSection';
import ServicesSection from '@/components/features/home/ServicesSection';
import HomeOffersCarousel from '@/components/features/home/HomeOffersCarousel';
import { createClient } from '@/lib/supabase/server';
import type { SpecialOffer } from '@/types/models';

/* -- Static reviews (ok) -- */
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

const FALLBACK_OFFERS: SpecialOffer[] = [
  {
    id: 'fallback-1',
    destination: 'Estambul, Turquía',
    destination_img: null,
    origin_airport_id: null,
    destination_airport_id: null,
    airline_id: null,
    flight_number: null,
    valid_dates: ['2026-03-15', '2026-03-18', '2026-03-22'],
    original_price: 1250,
    offer_price: 849,
    markup_percentage: 0,
    tags: ['exclusive', 'fire', 'few_seats'],
    urgency_label: 'Últimos cupos esta semana',
    max_seats: 20,
    sold_seats: 17,
    is_active: true,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fallback-2',
    destination: 'Madrid, España',
    destination_img: null,
    origin_airport_id: null,
    destination_airport_id: null,
    airline_id: null,
    flight_number: null,
    valid_dates: ['2026-03-10', '2026-03-12', '2026-03-20'],
    original_price: 980,
    offer_price: 699,
    markup_percentage: 0,
    tags: ['exclusive', 'flash_24h'],
    urgency_label: 'Promo Flash 24h',
    max_seats: 20,
    sold_seats: 10,
    is_active: true,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fallback-3',
    destination: 'Cancún, México',
    destination_img: null,
    origin_airport_id: null,
    destination_airport_id: null,
    airline_id: null,
    flight_number: null,
    valid_dates: ['2026-03-08', '2026-03-16', '2026-03-23'],
    original_price: 450,
    offer_price: 299,
    markup_percentage: 0,
    tags: ['exclusive'],
    urgency_label: null,
    max_seats: 20,
    sold_seats: 6,
    is_active: true,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default async function HomePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('special_offers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8);

  const offers = ((data as SpecialOffer[]) ?? []).filter(Boolean);
  const carouselOffers = offers.length ? offers : FALLBACK_OFFERS;


  return (
    <>
      <Navbar />

      {/* Hero */}
      <HeroSection />

      {/* Flight Search */}
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

      {/* Offers Carousel */}
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
              Carrusel visual con ofertas activas y fechas disponibles.
            </p>
          </div>

          <HomeOffersCarousel offers={carouselOffers} />
        </div>
      </section>

      {/* Landing sections */}
      <AboutSection />
      <ServicesSection />

      {/* Reviews */}
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
