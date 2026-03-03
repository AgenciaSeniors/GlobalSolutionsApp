import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SpecialOffer, CustomerExperience } from '@/types/models';
import { getServerLanguage } from '@/lib/i18n/serverLanguage';
import { translate } from '@/lib/i18n/translations';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/features/home/HeroSection';
import HomeOffersCarousel from '@/components/features/home/HomeOffersCarousel';
import CustomerExperienceCarousel from '@/components/features/home/CustomerExperienceCarousel';
import AboutSection from '@/components/features/home/AboutSection';
import ServicesSection from '@/components/features/home/ServicesSection';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import ReviewCard from '@/components/features/reviews/ReviewCard';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function getDestination(review: Record<string, unknown>, fallback: string): string {
  const booking = review.booking as Record<string, unknown> | null;
  if (!booking) return fallback;

  const flight = booking.flight as Record<string, unknown> | null;
  const offer = booking.offer as Record<string, unknown> | null;

  if (flight) {
    const dest = flight.destination_airport as Record<string, unknown> | null;
    if (dest?.city) return dest.city as string;
  }
  if (offer?.destination) return offer.destination as string;

  return fallback;
}

export default async function HomePage() {
  const lang = getServerLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const [offersRes, reviewsRes, experiencesRes] = await Promise.all([
    supabase
      .from('special_offers')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('reviews')
      .select(`
        id, profile_id, rating, comment, created_at,
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
    supabase
      .from('customer_experiences')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ]);

  const offers = ((offersRes.data as SpecialOffer[]) ?? []).filter(Boolean);
  const experiences = ((experiencesRes.data as CustomerExperience[]) ?? []).filter(Boolean);
  const dbReviews = (reviewsRes.data ?? []) as Record<string, unknown>[];
  const reviewCards =
    dbReviews.length > 0
      ? dbReviews.map(r => {
          const profile = r.profile as { full_name?: string | null } | null;
          const name = profile?.full_name || t('home.travelerFallback');
          const createdAt = new Date(r.created_at as string);

          return {
            authorName: name,
            authorInitials: getInitials(name),
            destination: getDestination(r, t('home.destinationFallback')),
            date: createdAt.toLocaleDateString(lang, { month: 'short', year: 'numeric' }),
            rating: r.rating as number,
            comment: r.comment as string,
          };
        })
      : [];

  return (
    <>
      <Navbar />
      <HeroSection />

      <section className="bg-neutral-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">
              {t('home.offers.badge')}
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              {t('home.offers.title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-600 sm:text-base">{t('home.offers.subtitle')}</p>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-neutral-700">{t('home.offers.empty')}</p>
            </div>
          ) : (
            <HomeOffersCarousel offers={offers} />
          )}
        </div>
      </section>

      {/* Customer Experiences carousel */}
      {experiences.length > 0 && (
        <section className="bg-neutral-50 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 text-center sm:mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-700">
                {t('home.experiences.badge')}
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
                {t('home.experiences.title')}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 sm:text-base">
                {t('home.experiences.subtitle')}
              </p>
            </div>
            <CustomerExperienceCarousel experiences={experiences} />
          </div>
        </section>
      )}

      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">{t('home.flightSearch.badge')}</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              {t('home.flightSearch.title')}
            </h2>
          </div>
          <FlightSearchForm />
        </div>
      </section>

      <AboutSection />
      <ServicesSection />

      <section className="bg-gradient-to-b from-neutral-50 to-brand-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">{t('home.reviews.badge')}</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">
              {t('home.reviews.title')}
            </h2>

            <div className="mt-6 flex justify-center">
              <Link
                href="/reviews"
                className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-sm hover:bg-neutral-50"
              >
                {t('home.reviews.cta')}
              </Link>
            </div>
          </div>

          {reviewCards.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-neutral-700">{t('home.reviews.empty')}</p>
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
