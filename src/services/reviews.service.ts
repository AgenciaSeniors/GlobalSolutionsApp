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
   const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'No se pudo enviar la reseña.');
  }
}

export const reviewsService = { listApproved, create };
