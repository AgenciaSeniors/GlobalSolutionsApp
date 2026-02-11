/**
 * @fileoverview Admin Review Moderation — Approve/reject reviews.
 * Per spec §7.2: Reviews enter as pending_approval, admin reviews
 * for inappropriate content, then publishes.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { Star, CheckCircle, XCircle } from 'lucide-react';

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  created_at: string;
  profile: { full_name: string; email: string } | null;
  booking: { booking_code: string } | null;
}

export default function AdminReviewsPage() {
  const supabase = createClient();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending_approval' | 'approved' | 'rejected'>('pending_approval');

  useEffect(() => { fetchReviews(); }, [filter]);

  async function fetchReviews() {
    setLoading(true);
    let query = supabase
      .from('reviews')
      .select('id, rating, title, comment, status, created_at, profile:profiles!user_id(full_name, email), booking:bookings!booking_id(booking_code)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    setReviews((data as unknown as ReviewItem[]) || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    await supabase.from('reviews').update({ status }).eq('id', id);
    fetchReviews();
  }

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />
    ));

  // CORRECCIÓN: Se cambió 'error' por 'destructive' para coincidir con las variantes de Badge
  const statusConfig: Record<string, { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
    pending_approval: { variant: 'warning', label: 'Pendiente' },
    approved: { variant: 'success', label: 'Aprobada' },
    rejected: { variant: 'destructive', label: 'Rechazada' },
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Moderar Reseñas" subtitle="Solo compradores verificados pueden opinar" />
        <div className="p-8">
          {/* Filters */}
          <div className="mb-6 flex gap-2">
            {(['pending_approval', 'approved', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {f === 'all' ? 'Todas' : statusConfig[f]?.label || f}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-neutral-500">Cargando reseñas...</p>
          ) : reviews.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
              <p className="font-semibold">No hay reseñas {filter !== 'all' ? 'con este filtro' : ''}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => {
                const cfg = statusConfig[review.status] || statusConfig.pending_approval;
                return (
                  <Card key={review.id} variant="bordered">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <div className="flex">{renderStars(review.rating)}</div>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          {review.booking && (
                            <span className="text-xs text-neutral-400">Reserva: {review.booking.booking_code}</span>
                          )}
                        </div>
                        {review.title && <p className="font-semibold text-neutral-800">{review.title}</p>}
                        <p className="mt-1 text-sm text-neutral-600">{review.comment}</p>
                        <p className="mt-2 text-xs text-neutral-400">
                          Por: {review.profile?.full_name || 'Anónimo'} · {new Date(review.created_at).toLocaleDateString('es')}
                        </p>
                      </div>
                      {review.status === 'pending_approval' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateStatus(review.id, 'approved')} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle className="h-4 w-4" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(review.id, 'rejected')} className="gap-1.5 text-red-600">
                            <XCircle className="h-4 w-4" /> Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}