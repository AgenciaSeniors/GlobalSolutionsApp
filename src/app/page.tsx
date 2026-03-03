import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SpecialOffer } from '@/types/models';
import HomePageContent from '@/components/features/home/HomePageContent';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function getDestination(review: Record<string, unknown>): string {
  const booking = review.booking as Record<string, unknown> | null;
  if (!booking) return '';

  const flight = booking.flight as Record<string, unknown> | null;
  const offer = booking.offer as Record<string, unknown> | null;

  if (flight) {
    const dest = flight.destination_airport as Record<string, unknown> | null;
    if (dest?.city) return dest.city as string;
  }
  if (offer?.destination) return offer.destination as string;

  return '';
}

export default async function HomePage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const [offersRes, reviewsRes] = await Promise.all([
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
  ]);

  const offers = ((offersRes.data as SpecialOffer[]) ?? []).filter(Boolean);
  const dbReviews = (reviewsRes.data ?? []) as Record<string, unknown>[];

  const reviews = dbReviews.map((r) => {
    const profile = r.profile as { full_name?: string | null } | null;
    const name = profile?.full_name || '';
    const createdAt = new Date(r.created_at as string);

    return {
      authorName: name,
      authorInitials: getInitials(name || 'Viajero'),
      destination: getDestination(r),
      dateEs: createdAt.toLocaleDateString('es', { month: 'short', year: 'numeric' }),
      dateEn: createdAt.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
      rating: r.rating as number,
      comment: r.comment as string,
    };
  });

  return <HomePageContent offers={offers} reviews={reviews} />;
}
