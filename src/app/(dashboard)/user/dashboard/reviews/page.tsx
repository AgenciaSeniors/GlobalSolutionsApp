/**
 * @fileoverview User Reviews — View my reviews + write new ones for completed trips.
 * Per spec §7.2: Reviews are verified (only completed bookings), require moderation.
 * Loyalty points awarded for approved reviews.
 *
 * Supports both flight bookings and offer bookings.
 *
 * FK constraints used in PostgREST joins:
 *   reviews_user_id_fkey     : profile_id → profiles(id)
 *   reviews_booking_id_fkey  : booking_id → bookings(id)
 *   bookings_flight_id_fkey  : flight_id  → flights(id)
 *   bookings_offer_id_fkey   : offer_id   → special_offers(id)
 *   flights_airline_id_fkey  : airline_id → airlines(id)
 *   flights_origin_airport_id_fkey / flights_destination_airport_id_fkey
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
  Star, PenSquare, CheckCircle, Clock, XCircle, Plane, Tag,
  ChevronDown, ChevronUp, Send, Sparkles,
} from 'lucide-react';

/* ---------- Types ---------- */

interface FlightJoin {
  flight_number: string;
  airline: { name: string } | null;
  origin_airport: { iata_code: string; city: string } | null;
  destination_airport: { iata_code: string; city: string } | null;
}

interface OfferJoin {
  destination: string;
  flight_number: string | null;
  airline: { name: string } | null;
  origin_airport: { iata_code: string; city: string } | null;
  destination_airport: { iata_code: string; city: string } | null;
}

interface ReviewableBooking {
  id: string;
  booking_code: string;
  total_amount: number;
  created_at: string;
  offer_id: string | null;
  flight: FlightJoin | FlightJoin[] | null;
  offer: OfferJoin | OfferJoin[] | null;
}

interface ReviewBookingJoin {
  booking_code: string;
  offer_id: string | null;
  flight: FlightJoin | FlightJoin[] | null;
  offer: OfferJoin | OfferJoin[] | null;
}

interface UserReview {
  id: string;
  booking_id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  created_at: string;
  booking: ReviewBookingJoin | ReviewBookingJoin[] | null;
}

/** Normalize PostgREST result: if array take first element */
function norm<T>(val: T | T[] | null | undefined): T | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

/** Build route summary from a booking row */
function routeLabel(b: { flight: FlightJoin | FlightJoin[] | null; offer: OfferJoin | OfferJoin[] | null; offer_id?: string | null }): string {
  const flight = norm(b.flight);
  const offer = norm(b.offer);
  if (flight) {
    const airline = flight.airline?.name ? `${flight.airline.name} · ` : '';
    const orig = flight.origin_airport?.city || '???';
    const dest = flight.destination_airport?.city || '???';
    return `${airline}${orig} → ${dest}`;
  }
  if (offer) {
    const airline = offer.airline?.name ? `${offer.airline.name} · ` : '';
    const orig = offer.origin_airport?.city || '';
    const dest = offer.destination_airport?.city || offer.destination || '???';
    return orig ? `${airline}${orig} → ${dest}` : `${airline}${dest}`;
  }
  return 'Viaje completado';
}

export default function UserReviewsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [reviewableBookings, setReviewableBookings] = useState<ReviewableBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (user) fetchData(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    setFetchError(null);

    try {
      const [reviewsRes, bookingsRes] = await Promise.all([
        // My reviews with booking info
        supabase
          .from('reviews')
          .select(`
            id, booking_id, rating, title, comment, status, created_at,
            booking:bookings!reviews_booking_id_fkey(
              booking_code, offer_id,
              flight:flights!bookings_flight_id_fkey(
                airline:airlines!flights_airline_id_fkey(name),
                origin_airport:airports!flights_origin_airport_id_fkey(iata_code, city),
                destination_airport:airports!flights_destination_airport_id_fkey(iata_code, city)
              ),
              offer:special_offers!bookings_offer_id_fkey(
                destination,
                flight_number,
                airline:airlines(name),
                origin_airport:airports!special_offers_origin_airport_id_fkey(iata_code, city),
                destination_airport:airports!special_offers_destination_airport_id_fkey(iata_code, city)
              )
            )
          `)
          .eq('profile_id', user!.id)
          .order('created_at', { ascending: false }),

        // Completed bookings that can be reviewed — use profile_id (NOT user_id)
        supabase
          .from('bookings')
          .select(`
            id, booking_code, total_amount, created_at, offer_id,
            flight:flights!bookings_flight_id_fkey(
              flight_number,
              airline:airlines!flights_airline_id_fkey(name),
              origin_airport:airports!flights_origin_airport_id_fkey(iata_code, city),
              destination_airport:airports!flights_destination_airport_id_fkey(iata_code, city)
            ),
            offer:special_offers!bookings_offer_id_fkey(
              destination,
              flight_number,
              airline:airlines(name),
              origin_airport:airports!special_offers_origin_airport_id_fkey(iata_code, city),
              destination_airport:airports!special_offers_destination_airport_id_fkey(iata_code, city)
            )
          `)
          .eq('profile_id', user!.id)
          .eq('booking_status', 'completed'),
      ]);

      if (reviewsRes.error) {
        console.error('[UserReviews] Reviews fetch error:', reviewsRes.error.message, reviewsRes.error.details, reviewsRes.error.hint);
      }
      if (bookingsRes.error) {
        console.error('[UserReviews] Bookings fetch error:', bookingsRes.error.message, bookingsRes.error.details, bookingsRes.error.hint);
      }

      if (reviewsRes.error && bookingsRes.error) {
        setFetchError('Error cargando datos de reseñas.');
        setLoading(false);
        return;
      }

      const reviewsList = (reviewsRes.data as unknown as UserReview[]) || [];
      const bookingsList = (bookingsRes.data as unknown as ReviewableBooking[]) || [];

      const existingReviewBookingIds = new Set(
        reviewsList.map((r) => r.booking_id),
      );

      setReviews(reviewsList);
      setReviewableBookings(
        bookingsList.filter(b => !existingReviewBookingIds.has(b.id)),
      );
    } catch (err) {
      console.error('[UserReviews] Unexpected error:', err);
      setFetchError('Error inesperado cargando reseñas.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReview(e: FormEvent, bookingId: string) {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!comment.trim()) {
      setMessage({ type: 'error', text: 'Por favor escribe tu experiencia.' });
      return;
    }
    if (comment.trim().length < 10) {
      setMessage({ type: 'error', text: 'Tu reseña debe tener al menos 10 caracteres.' });
      return;
    }
    if (rating < 1 || rating > 5) {
      setMessage({ type: 'error', text: 'Selecciona una calificación entre 1 y 5 estrellas.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    // IMPORTANT: insert profile_id (NOT user_id) — RLS demands profile_id = auth.uid()
    const { error } = await supabase.from('reviews').insert({
      profile_id: user.id,
      booking_id: bookingId,
      rating,
      title: title.trim() || null,
      comment: comment.trim(),
      status: 'pending_approval',
      photo_urls: [],
    });

    if (error) {
      console.error('[UserReviews] Insert error:', error.message, error.details, error.hint);
      if (error.message.includes('row-level security') || error.code === '42501') {
        setMessage({ type: 'error', text: 'Solo puedes dejar reseñas de tus propios viajes completados.' });
      } else {
        setMessage({ type: 'error', text: 'Error al enviar reseña: ' + error.message });
      }
    } else {
      setMessage({ type: 'success', text: '¡Reseña enviada! Será revisada por nuestro equipo.' });
      setShowForm(null);
      setRating(5);
      setTitle('');
      setComment('');
      fetchData();
    }
    setSubmitting(false);
    setTimeout(() => setMessage(null), 6000);
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

          {/* Toast messages */}
          {message && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          {/* Error banner */}
          {fetchError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Error:</strong> {fetchError}
              <button onClick={fetchData} className="ml-3 font-medium underline">Reintentar</button>
            </div>
          )}

          {/* Loyalty Points Info */}
          <Card variant="bordered" className="border-amber-200 bg-amber-50/30">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-800">Gana puntos por tus reseñas</p>
                <p className="text-sm text-amber-700">Cada reseña aprobada te otorga <strong>50 puntos</strong> de lealtad (100 si incluyes fotos) que puedes usar en futuras compras.</p>
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
                {reviewableBookings.map(b => {
                  const isOffer = !!b.offer_id;
                  return (
                    <Card key={b.id} variant="bordered" className={showForm === b.id ? 'ring-2 ring-brand-200' : ''}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                            {isOffer
                              ? <Tag className="h-5 w-5 text-brand-600" />
                              : <Plane className="h-5 w-5 text-brand-600" />
                            }
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{b.booking_code}</p>
                              {isOffer && <Badge variant="info" className="text-[10px]">Oferta</Badge>}
                            </div>
                            <p className="text-xs text-neutral-500 truncate">
                              {routeLabel(b)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={showForm === b.id ? 'outline' : 'primary'}
                          onClick={() => { setShowForm(showForm === b.id ? null : b.id); setRating(5); setTitle(''); setComment(''); setMessage(null); }}
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
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-neutral-700">Título (opcional)</label>
                            <Input
                              value={title}
                              onChange={e => setTitle(e.target.value)}
                              placeholder="Ej: Excelente servicio"
                              maxLength={100}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Tu experiencia *</label>
                            <textarea
                              value={comment}
                              onChange={e => setComment(e.target.value)}
                              rows={4}
                              maxLength={2000}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm resize-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                              placeholder="Cuéntanos sobre tu viaje, el servicio, los vuelos..."
                              required
                            />
                            <p className="mt-1 text-xs text-neutral-400">{comment.length}/2000 caracteres</p>
                          </div>
                          <Button type="submit" isLoading={submitting} className="gap-2">
                            <Send className="h-4 w-4" /> Enviar Reseña
                          </Button>
                        </form>
                      )}
                    </Card>
                  );
                })}
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
                  const isExpanded = expandedReview === r.id;
                  const displayComment = isExpanded
                    ? r.comment
                    : (r.comment.length > 180 ? r.comment.slice(0, 180) + '…' : r.comment);
                  const booking = norm(r.booking);

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
                          <p className="text-sm text-neutral-600 mt-1">{displayComment}</p>
                          {r.comment.length > 180 && (
                            <button
                              type="button"
                              onClick={() => setExpandedReview(isExpanded ? null : r.id)}
                              className="text-xs text-brand-600 hover:underline mt-1"
                            >
                              {isExpanded ? 'Ver menos' : 'Ver más'}
                            </button>
                          )}
                          <p className="text-xs text-neutral-400 mt-2">
                            {booking?.booking_code && `Reserva ${booking.booking_code} · `}
                            {booking ? routeLabel(booking) : ''}
                            {' · '}{new Date(r.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>

                        {r.comment.length > 180 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedReview(isExpanded ? null : r.id)}
                            className="mt-1 p-2"
                            aria-label={isExpanded ? 'Contraer reseña' : 'Expandir reseña'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
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
    </div>
  );
}
