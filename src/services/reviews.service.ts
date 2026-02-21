/**
 * @fileoverview Service layer for review queries.
 * Uses FK constraint names for PostgREST joins to avoid ambiguity.
 * @module services/reviews.service
 *
 * FK constraints on reviews table:
 *   reviews_user_id_fkey     : profile_id → profiles(id)
 *   reviews_booking_id_fkey  : booking_id → bookings(id)
 */
import { createClient } from '@/lib/supabase/client';
import type { ReviewWithAuthor } from '@/types/models';

export interface CreateReviewPayload {
  booking_id: string;
  rating: number; // 1..5
  title?: string;
  comment: string;
}

type BookingOwnershipRow = {
  id: string;
  payment_status: string | null;
  profile_id: string | null;
  user_id: string | null;
};

function assertRating(rating: number): void {
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('El rating debe estar entre 1 y 5.');
  }
}

function isPaid(status: string | null): boolean {
  return (status ?? '').toLowerCase() === 'paid';
}

/**
 * Fetch approved reviews for public display (home page).
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
 * Create a new review for a PAID booking.
 * IMPORTANT: inserts profile_id (NOT user_id) — RLS demands profile_id = auth.uid().
 */
async function create(payload: CreateReviewPayload): Promise<void> {
  assertRating(payload.rating);

  const supabase = createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error('Debes iniciar sesión.');

  // 1) Buscar booking y validar ownership + pago
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, payment_status, profile_id, user_id')
    .eq('id', payload.booking_id)
    .single<BookingOwnershipRow>();

  if (bookingErr) throw bookingErr;
  if (!booking) throw new Error('Reserva no encontrada.');

  const ownerOk = booking.profile_id === user.id || booking.user_id === user.id;
  if (!ownerOk) throw new Error('Forbidden');

  if (!isPaid(booking.payment_status)) {
    throw new Error('Solo puedes escribir una reseña después de pagar.');
  }

  // 2) Evitar duplicadas
  const { data: existing, error: existingErr } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', payload.booking_id)
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();

  if (existingErr) throw existingErr;
  if (existing?.id) throw new Error('Ya existe una reseña para esta reserva.');

  // 3) Insert
  const { error } = await supabase.from('reviews').insert({
    booking_id: payload.booking_id,
    rating: payload.rating,
    title: payload.title,
    comment: payload.comment,
    profile_id: user.id,
    status: 'pending_approval',
    photo_urls: [],
  });

  if (error) throw error;
}

export const reviewsService = { listApproved, create };