/**
 * @fileoverview Admin Review Moderation — Approve or reject user reviews.
 * Per spec §7.2: Only admins can moderate reviews; approved reviews get loyalty points.
 * The DB trigger `auto_award_review_points` fires on status change to 'approved'.
 *
 * Supports both flight and offer bookings in review context.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Star, CheckCircle, XCircle, Sparkles, AlertCircle } from 'lucide-react';

/* ---------- Types ---------- */

interface ProfileJoin {
  full_name: string;
  email: string;
}

interface BookingJoin {
  booking_code: string;
  offer_id: string | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  photo_urls: string[];
  status: string;
  created_at: string;
  profile: ProfileJoin | ProfileJoin[] | null;
  booking: BookingJoin | BookingJoin[] | null;
}

/** Normalize PostgREST result: if array take first element */
function norm<T>(val: T | T[] | null | undefined): T | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

type FilterKey = 'all' | 'pending_approval' | 'approved' | 'rejected';

export default function AdminReviewsPage() {
  const supabase = createClient();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending_approval');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { fetchReviews(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchReviews() {
    setLoading(true);
    setFetchError(null);

    try {
      /**
       * FK constraints on reviews table:
       *   reviews_user_id_fkey     : profile_id → profiles(id)
       *   reviews_booking_id_fkey  : booking_id → bookings(id)
       *   reviews_moderated_by_fkey: moderated_by → profiles(id)
       */
      let query = supabase
        .from('reviews')
        .select(`
          id, rating, title, comment, photo_urls, status, created_at,
          profile:profiles!reviews_user_id_fkey(full_name, email),
          booking:bookings!reviews_booking_id_fkey(booking_code, offer_id)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AdminReviews] Fetch error:', error.message, error.details, error.hint);
        setFetchError(error.message);
        setReviews([]);
      } else {
        setReviews((data as unknown as ReviewItem[]) || []);
      }
    } catch (err) {
      console.error('[AdminReviews] Unexpected error:', err);
      setFetchError('Error inesperado cargando reseñas.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    const actionLabel = status === 'approved' ? 'aprobar' : 'rechazar';
    const confirmMsg = status === 'approved'
      ? '¿Aprobar esta reseña? Se publicará y el usuario recibirá puntos de lealtad automáticamente.'
      : '¿Rechazar esta reseña? No se publicará.';

    if (!confirm(confirmMsg)) return;
    setActionLoading(id);

    try {
      // En app nativa, las cookies de sesión pueden no llegar al servidor Next.js.
      // Enviamos el access_token en el header Authorization como fallback.
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (Capacitor.isNativePlatform()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(`[AdminReviews] ${actionLabel} error:`, res.status, data);
        alert(`Error al ${actionLabel}: ${(data as { error?: string }).error ?? res.statusText}`);
        return;
      }

      await fetchReviews();
    } catch (err) {
      console.error(`[AdminReviews] ${actionLabel} unexpected error:`, err);
      alert(`Error inesperado al ${actionLabel}.`);
    } finally {
      setActionLoading(null);
    }
  }

  /* ---------- Rendering helpers ---------- */

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />
    ));

  const statusConfig: Record<string, { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
    pending_approval: { variant: 'warning', label: 'Pendiente' },
    approved: { variant: 'success', label: 'Aprobada' },
    rejected: { variant: 'destructive', label: 'Rechazada' },
  };

  // Count pending reviews
  const pendingCount = filter === 'pending_approval' ? reviews.length : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Moderar Reseñas" subtitle="Solo compradores verificados pueden opinar" />
        <div className="p-8 space-y-6">

          {/* Info about auto points */}
          <Card variant="bordered" className="border-amber-200 bg-amber-50/20">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Al aprobar una reseña, el usuario recibe automáticamente <strong>50 puntos</strong> de lealtad
                (100 si incluyó fotos). Esto es manejado por un trigger de base de datos.
              </p>
            </div>
          </Card>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
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

          {/* Error banner */}
          {fetchError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              <strong>Error:</strong> {fetchError}
              <button onClick={fetchReviews} className="ml-3 font-medium underline">Reintentar</button>
            </div>
          )}

          {loading ? (
            <p className="text-neutral-500">Cargando reseñas...</p>
          ) : reviews.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
              <p className="font-semibold">No hay reseñas {filter !== 'all' ? 'con este filtro' : ''}</p>
              {filter === 'pending_approval' && (
                <p className="mt-1 text-sm text-neutral-500">¡Todas las reseñas han sido moderadas!</p>
              )}
            </Card>
          ) : (
            <>
              {pendingCount !== null && pendingCount > 0 && (
                <p className="text-sm text-neutral-500">
                  {pendingCount} reseña{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aprobación
                </p>
              )}
              <div className="space-y-4">
                {reviews.map(review => {
                  const cfg = statusConfig[review.status] || statusConfig.pending_approval;
                  const hasPhotos = review.photo_urls && review.photo_urls.length > 0;
                  const profile = norm(review.profile);
                  const booking = norm(review.booking);
                  const isActionLoading = actionLoading === review.id;
                  const isOffer = !!booking?.offer_id;

                  return (
                    <Card key={review.id} variant="bordered">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3 flex-wrap">
                            <div className="flex">{renderStars(review.rating)}</div>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            {booking && (
                              <span className="text-xs text-neutral-400">
                                Reserva: {booking.booking_code}
                                {isOffer && ' (Oferta)'}
                              </span>
                            )}
                            {hasPhotos && (
                              <Badge variant="info" className="text-[10px]">Con fotos ({review.photo_urls.length})</Badge>
                            )}
                          </div>
                          {review.title && <p className="font-semibold text-neutral-800">{review.title}</p>}
                          <p className="mt-1 text-sm text-neutral-600 whitespace-pre-wrap">{review.comment}</p>
                          <p className="mt-2 text-xs text-neutral-400">
                            Por: {profile?.full_name || 'Anónimo'} ({profile?.email || '—'})
                            {' · '}{new Date(review.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>

                        {review.status === 'pending_approval' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => updateStatus(review.id, 'approved')}
                              disabled={isActionLoading}
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle className="h-4 w-4" />
                              {isActionLoading ? 'Procesando...' : 'Aprobar'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(review.id, 'rejected')}
                              disabled={isActionLoading}
                              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                              {isActionLoading ? 'Procesando...' : 'Rechazar'}
                            </Button>
                          </div>
                        )}

                        {/* Re-approve/reject already moderated */}
                        {review.status === 'rejected' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(review.id, 'approved')}
                              disabled={isActionLoading}
                              className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                              {isActionLoading ? 'Procesando...' : 'Aprobar'}
                            </Button>
                          </div>
                        )}

                        {review.status === 'approved' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(review.id, 'rejected')}
                              disabled={isActionLoading}
                              className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                              {isActionLoading ? 'Procesando...' : 'Quitar'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
