/**
 * @fileoverview Server-side helper to fetch aggregate review stats for structured data.
 * Uses React cache() to deduplicate within a single request.
 * @module lib/seo/review-stats
 */
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ReviewStats {
  ratingValue: number;
  reviewCount: number;
  bestReview: {
    author: string;
    rating: number;
    body: string;
  } | null;
}

/**
 * Fetch aggregate review stats from approved reviews.
 * Cached per request via React cache() — safe to call from multiple components.
 */
export const getReviewStats = cache(async (): Promise<ReviewStats | null> => {
  const supabase = createAdminClient();

  // Get count and average rating
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('rating, title, comment, profile:profiles!reviews_user_id_fkey(full_name)')
    .eq('status', 'approved')
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !reviews || reviews.length === 0) {
    return null;
  }

  const totalRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = Math.round((totalRatings / reviews.length) * 10) / 10;

  // Pick the best review (highest rated, with a comment)
  const best = reviews.find((r) => r.comment && r.comment.length > 10);
  const profileData = best?.profile as unknown as { full_name: string | null } | null;

  return {
    ratingValue: avgRating,
    reviewCount: reviews.length,
    bestReview: best
      ? {
          author: profileData?.full_name || 'Cliente verificado',
          rating: best.rating,
          body: best.comment!,
        }
      : null,
  };
});
