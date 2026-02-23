/**
 * @fileoverview Landing page — Hero, FlightSearch, Offers Carousel,
 *               Trust, About, Services, Reviews and CTA.
 * @module app/page
 */
import Link from 'next/link';
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

/** Build initials from a full name like "María García" → "MG" */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

/** Extract destination from a review's joined booking (flight or offer). */
function getDestination(review: Record<string, unknown>): string {
  const booking = review.booking as Record<string, unknown> | null;
  if (!booking) return 'Destino';

  const flight = booking.flight as Record<string, unknown> | null;
  const offer = booking.offer as Record<string, unknown> | null;

  if (flight) {
    const dest = flight.destination_airport as Record<string, unknown> | null;
    if (dest?.city) return dest.city as string;
  }
  if (offer?.destination) return offer.destination as string;

  return 'Destino';
}

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch offers and approved reviews in parallel
  const [offersRes, reviewsRes] = await Promise.all([
    supabase
      .from('special_offers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        profile:profiles!reviews_user_id_fkey(full_name, avatar_url),
        booking:bookings!reviews_booking_id_fkey(
          booking_code,
          flight:flights!bookings_flight_id_fkey(
            destination_airport:airports!flights_destination_airport_id_fkey(city)
          ),
          offer:special_offers!bookings_offer_id_fkey(destination)
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const offers = ((offersRes.data as SpecialOffer[]) ?? []).filter(Boolean);

  // Build review cards ONLY from DB (no fake fallback)
  const dbReviews = (reviewsRes.data ?? []) as Record<string, unknown>[];
  const reviewCards =
    dbReviews.length > 0
      ? dbReviews.map(r => {
          const profile = r.profile as { full_name?: string | null } | null;
          const name = profile?.full_name || 'Viajero';
          const createdAt = new Date(r.created_at as string);

          return {
            authorName: name,
            authorInitials: getInitials(name),
            destination: getDestination(r),
            date: createdAt.toLocaleDateString('es', { month: 'short', year: 'numeric' }),
            rating: r.rating as number,
            comment: r.comment as string,
          };
        })
      : [];

  return (
    <>
      <Navbar />

      {/* Hero */}
      <HeroSection />

      {/* Flight Search */}
      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
              Búsqueda de Vuelos
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              Encuentra tu vuelo ideal
            </h2>
          </div>
          <FlightSearchForm />
        </div>
      </section>

      {/* Offers Carousel */}
      <section className="bg-neutral-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
              🔥 Ofertas Exclusivas
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              Destinos imperdibles
            </h2>
            <p className="mt-2 text-sm text-neutral-600 sm:text-base">
              Carrusel visual con ofertas activas y fechas disponibles.
            </p>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-neutral-700">
                Por ahora no hay ofertas activas. Vuelve pronto para ver promociones nuevas.
              </p>
            </div>
          ) : (
            <HomeOffersCarousel offers={offers} />
          )}
        </div>
      </section>

      {/* Landing sections */}
      <AboutSection />
      <ServicesSection />

      {/* Reviews */}
      <section className="bg-gradient-to-b from-neutral-50 to-brand-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">
              Reseñas Verificadas
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              Lo que dicen nuestros viajeros
            </h2>

            {/* CTA: Ver reseñas */}
            <div className="mt-6 flex justify-center">
              <Link
                href="/reviews"
                className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-sm hover:bg-neutral-50"
              >
                Ver reseñas
              </Link>
            </div>
          </div>

          {reviewCards.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-neutral-700">
                Aún no hay reseñas publicadas. ¡Sé el primero en dejar la tuya después de comprar!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {reviewCards.slice(0, 3).map((r, i) => (
                <ReviewCard key={`${r.authorName}-${i}`} {...r} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}