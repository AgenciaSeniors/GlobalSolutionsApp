/**
 * @fileoverview Single verified review card with star rating and author meta.
 * @module components/features/reviews/ReviewCard
 */
import { Star, CheckCircle } from 'lucide-react';

interface ReviewCardProps {
  authorName: string;
  authorInitials: string;
  destination: string;
  date: string;
  rating: number;
  comment: string;
}

export default function ReviewCard({
  authorName,
  authorInitials,
  destination,
  date,
  rating,
  comment,
}: ReviewCardProps) {
  return (
    <article className="rounded-2xl border border-neutral-100 bg-white p-7 shadow-sm">
      {/* Stars */}
      <div className="mb-4 flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-[18px] w-[18px]"
            fill={i < rating ? '#fbbf24' : 'none'}
            stroke="#fbbf24"
            strokeWidth={2}
          />
        ))}
      </div>

      {/* Comment */}
      <p className="text-[15px] leading-relaxed text-neutral-700">
        &ldquo;{comment}&rdquo;
      </p>

      {/* Author */}
      <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-bold text-brand-700">
          {authorInitials}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-900">{authorName}</p>
          <p className="text-xs text-neutral-500">
            Viajó a {destination} · {date}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
          <CheckCircle className="h-3 w-3" />
          Verificado
        </span>
      </div>
    </article>
  );
}
