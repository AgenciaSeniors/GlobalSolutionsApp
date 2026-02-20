/**
 * @fileoverview Service layer for review queries.
 * Uses FK constraint names for PostgREST joins to avoid ambiguity.
 * @module services/reviews.service
 */
import { createClient } from '@/lib/supabase/client';
import type { ReviewWithAuthor } from '@/types/models';

/**
 * Fetch approved reviews for public display (home page).
 * Uses constraint name `reviews_user_id_fkey` because that FK points
 * profile_id -> profiles(id), disambiguating from moderated_by FK.
 */
async function listApproved(limit = 10): Promise<ReviewWithAuthor[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id, profile_id, booking_id, rating, title, comment, photo_urls,
      status, created_at,
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
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as ReviewWithAuthor[];
}

/**
 * Create a new review for a completed booking.
 * IMPORTANT: inserts profile_id (NOT user_id) — RLS demands profile_id = auth.uid().
 */
async function create(payload: {
  booking_id: string;
  rating: number;
  title?: string;
  comment: string;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión.');

  const { error } = await supabase.from('reviews').insert({
    ...payload,
    profile_id: user.id,
    photo_urls: [],
  });

  if (error) throw error;
}

export const reviewsService = { listApproved, create };
