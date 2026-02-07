/**
 * @fileoverview User Reviews — View my reviews + write new ones for completed trips.
 * Per spec §7.2: Reviews are verified (only completed bookings), require moderation.
 * Loyalty points awarded for approved reviews.
 */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  Star, PenSquare, CheckCircle, Clock, XCircle, Plane,
  ChevronDown, ChevronUp, Send, Sparkles,
} from 'lucide-react';

interface ReviewableBooking {
  id: string;
  booking_code: string;
  total_amount: number;
  created_at: string;
  flight?: {
    flight_number: string;
    airline: { name: string } | null;
    origin_airport: { iata_code: string; city: string } | null;
    destination_airport: { iata_code: string; city: string } | null;
  } | null;
}

interface UserReview {
  id: string;
  booking_id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  created_at: string;
  booking?: {
    booking_code: string;
    flight?: {
      airline: { name: string } | null;
      origin_airport: { iata_code: string; city: string } | null;
      destination_airport: { iata_code: string; city: string } | null;
    } | null;
  } | null;
}

export default function UserReviewsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewableBookings, setReviewableBookings] = useState<ReviewableBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);

    const [reviewsRes, bookingsRes] = await Promise.all([
      supabase
        .from('reviews')
        .select(`
          id, booking_id, rating, title, comment, status, created_at,
          booking:bookings!booking_id(
            booking_code,
            flight:flights!flight_id(
              airline:airlines!airline_id(name),
              origin_airport:airports!origin_airport_id(iata_code, city),
              destination_airport:airports!destination_airport_id(iata_code, city)
            )
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select(`
          id, booking_code, total_amount, created_at,
          flight:flights!flight_id(
            flight_number,
            airline:airlines!airline_id(name),
            origin_airport:airports!origin_airport_id(iata_code, city),
            destination_airport:airports!destination_airport_id(iata_code, city)
          )
        `)
        .eq('user_id', user!.id)
        .eq('booking_status', 'completed'),
    ]);

    const existingReviewBookingIds = new Set(
      (reviewsRes.data || []).map((r: { booking_id: string }) => r.booking_id)
    );

    setReviews(reviewsRes.data as unknown as UserReview[] || []);
    setReviewableBookings(
      ((bookingsRes.data as unknown as ReviewableBooking[]) || [])
        .filter(b => !existingReviewBookingIds.has(b.id))
    );
    setLoading(false);
  }

  async function handleSubmitReview(e: FormEvent, bookingId: string) {
    e.preventDefault();
    if (!user || !comment.trim()) return;
    setSubmitting(true);
    setMessage(null);

    const { error } = await supabase.from('reviews').insert({
      user_id: user.id,
      booking_id: bookingId,
      rating,
      title: title.trim() || null,
      comment: comment.trim(),
      status: 'pending_approval',
      photo_urls: [],
    });

    if (error) {
      setMessage({ type: 'error', text: 'Error al enviar reseña: ' + error.message });
    } else {
      setMessage({ type: 'success', text: '¡Reseña enviada! Será revisada por nuestro equipo.' });
      setShowForm(null);
      setRating(5);
      setTitle('');
      setComment('');
      fetchData();
    }
    setSubmitting(false);
    setTimeout(() => setMessage(null), 5000);
  }

  const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: 'warning' | 'success' | 'destructive' }> = {
    pending_approval: { label: 'En revisión', icon: Clock, variant: 'warning' },
    approved: { label: 'Publicada', icon: CheckCircle, variant: 'success' },
    rejected: { label: 'Rechazada', icon: XCircle, variant: 'destructive' },
  };

  const StarRating = ({ value, interactive = false }: { value: number; interactive?: boolean }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => setRating(s) : undefined}
          onMouseEnter={interactive ? () => setHoverRating(s) : undefined}
          onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              s <= (interactive ? (hoverRating || rating) : value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-neutral-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Mis Reseñas" subtitle="Comparte tu experiencia y gana puntos de lealtad" />
        <div className="p-8 space-y-8 max-w-4xl">

          {message && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          {/* Loyalty Points Info */}
          <Card variant="bordered" className="border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-800">Gana puntos por tus reseñas</p>
                <p className="text-sm text-amber-700">Cada reseña aprobada te otorga puntos de lealtad que puedes usar en futuras compras.</p>
              </div>
            </div>
          </Card>

          {/* Reviewable Bookings */}
          {reviewableBookings.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <PenSquare className="h-5 w-5 text-brand-500" />
                Viajes pendientes de reseña ({reviewableBookings.length})
              </h2>
              <div className="space-y-3">
                {reviewableBookings.map(b => (
                  <Card key={b.id} variant="bordered" className={showForm === b.id ? 'ring-2 ring-brand-200' : ''}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                          <Plane className="h-5 w-5 text-brand-600" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{b.booking_code}</p>
                          <p className="text-xs text-neutral-500 truncate">
                            {b.flight?.airline?.name && `${b.flight.airline.name} · `}
                            {b.flight?.origin_airport?.city} → {b.flight?.destination_airport?.city}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={showForm === b.id ? 'outline' : 'default'}
                        onClick={() => { setShowForm(showForm === b.id ? null : b.id); setRating(5); setTitle(''); setComment(''); }}
                        className="gap-1 flex-shrink-0"
                      >
                        <PenSquare className="h-3.5 w-3.5" />
                        {showForm === b.id ? 'Cancelar' : 'Escribir Reseña'}
                      </Button>
                    </div>

                    {showForm === b.id && (
                      <form onSubmit={e => handleSubmitReview(e, b.id)} className="mt-4 border-t border-neutral-100 pt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">Tu calificación</label>
                          <StarRating value={rating} interactive />
                        </div>
                        <Input
                          label="Título (opcional)"
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder="Ej: Excelente servicio"
                        />
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-neutral-700">Tu experiencia *</label>
                          <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={4}
                            className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm resize-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            placeholder="Cuéntanos sobre tu viaje, el servicio, los vuelos..."
                            required
                          />
                        </div>
                        <Button type="submit" isLoading={submitting} className="gap-2">
                          <Send className="h-4 w-4" /> Enviar Reseña
                        </Button>
                      </form>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* My Reviews */}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Mis Reseñas ({reviews.length})</h2>
            {loading ? (
              <Card variant="bordered"><p className="text-neutral-400 text-sm py-4">Cargando...</p></Card>
            ) : reviews.length === 0 && reviewableBookings.length === 0 ? (
              <Card variant="bordered" className="text-center py-10">
                <Star className="mx-auto h-10 w-10 text-neutral-200 mb-2" />
                <p className="font-semibold text-neutral-700">Sin reseñas todavía</p>
                <p className="text-sm text-neutral-500 mt-1">Completa un viaje para poder dejar tu reseña.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => {
                  const cfg = statusConfig[r.status] || statusConfig.pending_approval;
                  const StatusIcon = cfg.icon;
                  return (
                    <Card key={r.id} variant="bordered">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StarRating value={r.rating} />
                            <Badge variant={cfg.variant} className="text-[10px]">
                              <StatusIcon className="mr-1 h-3 w-3 inline" />{cfg.label}
                            </Badge>
                          </div>
                          {r.title && <p className="font-semibold text-neutral-900 mt-2">{r.title}</p>}
                          <p className="text-sm text-neutral-600 mt-1">{r.comment}</p>
                          <p className="text-xs text-neutral-400 mt-2">
                            {r.booking?.booking_code && `Reserva ${r.booking.booking_code} · `}
                            {r.booking?.flight?.origin_airport?.city} → {r.booking?.flight?.destination_airport?.city}
                            {' · '}{new Date(r.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
