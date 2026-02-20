/**
 * @fileoverview Service layer for review queries.
 * @module services/reviews.service
 *
 * FK constraints on reviews table:
 *   reviews_user_id_fkey     : profile_id → profiles(id)
 *   reviews_booking_id_fkey  : booking_id → bookings(id)
 */
import { createClient } from '@/lib/supabase/client';
import type { ReviewWithAuthor } from '@/types/models';

async function listApproved(limit = 10): Promise<ReviewWithAuthor[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('reviews')
    .select('*, profile:profiles!reviews_user_id_fkey(full_name, avatar_url)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as ReviewWithAuthor[];
}

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
    status: 'pending_approval',
    photo_urls: [],
  });

  if (error) throw error;
}

export const reviewsService = { listApproved, create };
