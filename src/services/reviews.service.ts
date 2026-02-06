/**
 * @fileoverview Service layer for review queries.
 * @module services/reviews.service
 */
import { createClient } from '@/lib/supabase/client';
import type { ReviewWithAuthor } from '@/types/models';

async function listApproved(limit = 10): Promise<ReviewWithAuthor[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('reviews')
    .select('*, profile:profiles(full_name, avatar_url)')
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
    user_id: user.id,
  });

  if (error) throw error;
}

export const reviewsService = { listApproved, create };
