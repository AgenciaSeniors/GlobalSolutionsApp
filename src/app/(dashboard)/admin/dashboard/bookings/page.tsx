/**
 * @fileoverview Admin All Bookings — Master CRM table.
 * Per spec §2.3: "Database of clients with purchase history and frequency for analysis."
 *
 * Features:
 * - Filter by status (all, pending, confirmed, completed, cancelled)
 * - Search by booking code, client name, email
 * - Expandable detail with passenger data
 * - Quick action: link to emission, mark as completed, cancel
 * - Zelle pending filter + approve/reject actions
 * - Offer bookings support (offer_id → special_offers join)
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarCheck,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Plane,
  Tag,
} from 'lucide-react';

/* ---------- Types ---------- */

/** Joined profile data from profiles table */
interface ProfileData {
  full_name: string;
  email: string;
  phone: string | null;
  loyalty_points: number;
}

/** Joined flight data with nested airline/airport joins */
interface FlightData {
  flight_number: string;
  departure_datetime: string;
  base_price: number;
  final_price: number;
  markup_percentage: number;
  airline: { name: string; iata_code: string } | null;
  origin_airport: { iata_code: string; city: string } | null;
  destination_airport: { iata_code: string; city: string } | null;
}

/** Joined offer data from special_offers */
interface OfferData {
  id: string;
  destination: string;
  destination_img: string | null;
  offer_price: number;
  original_price: number;
  flight_number: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  cabin_class: string | null;
  airline: { name: string; iata_code: string } | null;
  origin_airport: { iata_code: string; city: string } | null;
  destination_airport: { iata_code: string; city: string } | null;
}

interface BookingRow {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  payment_gateway: string | null;
  total_amount: number;
  subtotal: number;
  payment_gateway_fee: number;
  airline_pnr: string | null;
  created_at: string;
  paid_at: string | null;
  return_date: string | null;
  emitted_at: string | null;
  offer_id: string | null;
  selected_date: string | null;
  // Joined relations — PostgREST returns array for !fkey joins; we normalize below
  profile: ProfileData | ProfileData[] | null;
  flight: FlightData | FlightData[] | null;
  offer: OfferData | OfferData[] | null;
  passengers: { id: string; first_name: string; last_name: string; ticket_number: string | null }[];
}

/** Normalize PostgREST result: if array take first element, else keep as-is */
function norm<T>(val: T | T[] | null): T | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

// Badge variants
const STATUS_CONFIG: Record<
  string,
  { variant: 'warning' | 'success' | 'destructive' | 'info'; label: string; icon: typeof Clock }
> = {
  pending_emission: { variant: 'warning', label: 'Pendiente Emisión', icon: Clock },
  confirmed: { variant: 'success', label: 'Emitida', icon: CheckCircle },
  completed: { variant: 'info', label: 'Completada', icon: CalendarCheck },
  cancelled: { variant: 'destructive', label: 'Cancelada', icon: XCircle },
};

const PAYMENT_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
  paid: 'success',
  pending: 'warning',
  pending_admin_approval: 'info',
  failed: 'destructive',
  refunded: 'destructive',
};

type FilterKey = 'all' | 'pending_emission' | 'confirmed' | 'completed' | 'cancelled' | 'zelle_pending';

export default function AdminBookingsPage() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Per-row action loading
  const [rowAction, setRowAction] = useState<{ id: string; kind: 'approve' | 'reject' } | null>(null);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function fetchBookings() {
    setLoading(true);
    setFetchError(null);

    try {
      /**
       * PostgREST join syntax uses FK constraint names to disambiguate
       * when multiple FKs point to the same table.
       *
       * Real FK constraints on bookings table:
       *   bookings_user_id_fkey      : profile_id → profiles(id)
       *   bookings_flight_id_fkey    : flight_id  → flights(id)
       *   bookings_offer_id_fkey     : offer_id   → special_offers(id)
       *   bookings_assigned_agent_id_fkey : assigned_agent_id → profiles(id)
       *   bookings_emitted_by_fkey   : emitted_by → profiles(id)
       *
       * Real FK constraints on flights table:
       *   flights_airline_id_fkey              : airline_id → airlines(id)
       *   flights_origin_airport_id_fkey       : origin_airport_id → airports(id)
       *   flights_destination_airport_id_fkey  : destination_airport_id → airports(id)
       *
       * Real FK constraints on special_offers table:
       *   (airline_id, origin_airport_id, destination_airport_id → same pattern)
       */
      let query = supabase
        .from('bookings')
        .select(
          `
          id, booking_code, booking_status, payment_status, payment_method, payment_gateway,
          total_amount, subtotal, payment_gateway_fee, airline_pnr,
          created_at, paid_at, return_date, emitted_at, offer_id, selected_date,
          profile:profiles!bookings_user_id_fkey(full_name, email, phone, loyalty_points),
          flight:flights!bookings_flight_id_fkey(
            flight_number, departure_datetime, base_price, final_price, markup_percentage,
            airline:airlines!flights_airline_id_fkey(name, iata_code),
            origin_airport:airports!flights_origin_airport_id_fkey(iata_code, city),
            destination_airport:airports!flights_destination_airport_id_fkey(iata_code, city)
          ),
          offer:special_offers!bookings_offer_id_fkey(
            id, destination, destination_img, offer_price, original_price,
            flight_number, departure_time, arrival_time, cabin_class,
            airline:airlines(name, iata_code),
            origin_airport:airports!special_offers_origin_airport_id_fkey(iata_code, city),
            destination_airport:airports!special_offers_destination_airport_id_fkey(iata_code, city)
          ),
          passengers:booking_passengers!booking_passengers_booking_id_fkey(id, first_name, last_name, ticket_number)
        `
        )
        .order('created_at', { ascending: false })
        .limit(200);

      // Normal booking_status filters
      if (filter !== 'all' && filter !== 'zelle_pending') {
        query = query.eq('booking_status', filter);
      }

      // Zelle Pending filter
      if (filter === 'zelle_pending') {
        query = query
          .eq('payment_method', 'zelle')
          .eq('payment_status', 'pending_admin_approval');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AdminBookings] Supabase query error:', error.message, error.details, error.hint);
        setFetchError(error.message);
        setBookings([]);
      } else {
        setBookings((data as unknown as BookingRow[]) || []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[AdminBookings] Unexpected error:', msg);
      setFetchError(msg);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Actions ---------- */
  async function markCompleted(id: string) {
    if (!confirm('¿Marcar esta reserva como completada (viaje finalizado)?')) return;
    const { error } = await supabase.from('bookings').update({ booking_status: 'completed' }).eq('id', id);
    if (error) {
      console.error('[AdminBookings] markCompleted error:', error.message);
      alert('Error: ' + error.message);
      return;
    }
    fetchBookings();
  }

  async function markCancelled(id: string) {
    if (!confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('bookings').update({ booking_status: 'cancelled' }).eq('id', id);
    if (error) {
      console.error('[AdminBookings] markCancelled error:', error.message);
      alert('Error: ' + error.message);
      return;
    }
    fetchBookings();
  }

  // Zelle approval
  async function approveZelle(bookingId: string) {
    if (!confirm('¿Confirmar pago por Zelle? Esto marcará la reserva como PAGADA.')) return;

    try {
      setRowAction({ id: bookingId, kind: 'approve' });

      const res = await fetch('/api/payments/zelle/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || 'Error aprobando pago Zelle.');
        return;
      }

      await fetchBookings();
      alert('✅ Pago Zelle confirmado.');
    } finally {
      setRowAction(null);
    }
  }

  // Zelle rejection
  async function rejectZelle(bookingId: string) {
    const reason = prompt('Razón del rechazo (opcional):') || undefined;
    if (!confirm('¿Rechazar pago Zelle? Esto marcará la reserva como FALLIDA.')) return;

    try {
      setRowAction({ id: bookingId, kind: 'reject' });

      const res = await fetch('/api/payments/zelle/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, reason }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || 'Error rechazando pago Zelle.');
        return;
      }

      await fetchBookings();
      alert('❌ Pago Zelle rechazado.');
    } finally {
      setRowAction(null);
    }
  }

  /* ---------- Filtered (client-side search) ---------- */
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const profile = norm(b.profile);
      const flight = norm(b.flight);
      const offer = norm(b.offer);
      return (
        b.booking_code.toLowerCase().includes(s) ||
        (profile?.full_name || '').toLowerCase().includes(s) ||
        (profile?.email || '').toLowerCase().includes(s) ||
        (b.airline_pnr || '').toLowerCase().includes(s) ||
        (flight?.flight_number || '').toLowerCase().includes(s) ||
        (offer?.destination || '').toLowerCase().includes(s)
      );
    });
  }, [bookings, search]);

  /* ---------- Summary stats ---------- */
  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + Number(b.total_amount), 0);

  const totalProfit = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => {
      const flight = norm(b.flight);
      const offer = norm(b.offer);
      if (flight) {
        const markup = (flight.final_price || 0) - (flight.base_price || 0);
        return sum + markup * (b.passengers?.length || 1);
      }
      if (offer) {
        const markup = (offer.offer_price || 0) - (offer.original_price || 0);
        return sum + markup * (b.passengers?.length || 1);
      }
      return sum;
    }, 0);

  /* ---------- Helper: route summary line ---------- */
  function routeSummary(b: BookingRow): string {
    const flight = norm(b.flight);
    const offer = norm(b.offer);

    if (flight) {
      const airlineCode = flight.airline?.iata_code || '';
      const flightNum = flight.flight_number || '';
      const orig = flight.origin_airport?.iata_code || '???';
      const dest = flight.destination_airport?.iata_code || '???';
      return `${airlineCode} ${flightNum} · ${orig} → ${dest}`;
    }

    if (offer) {
      const airlineCode = offer.airline?.iata_code || '';
      const flightNum = offer.flight_number || '';
      const orig = offer.origin_airport?.iata_code || '???';
      const dest = offer.destination_airport?.iata_code || offer.destination || '???';
      return `${airlineCode} ${flightNum} · ${orig} → ${dest}`.trim();
    }

    return '—';
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header title="Todas las Reservas" subtitle="Base de datos CRM — Historial completo de clientes" />
        <div className="p-6 lg:p-8">
          {/* Summary */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Total Reservas</p>
              <p className="text-2xl font-bold">{bookings.length}</p>
            </Card>
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Ingresos Totales</p>
              <p className="text-2xl font-bold text-emerald-600">
                ${totalRevenue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </Card>
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Ganancia por Markup</p>
              <p className="text-2xl font-bold text-brand-600">
                ${totalProfit.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </Card>
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Pasajeros Totales</p>
              <p className="text-2xl font-bold">{bookings.reduce((s, b) => s + (b.passengers?.length || 0), 0)}</p>
            </Card>
          </div>

          {/* Filters + Search */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'all',
                  'pending_emission',
                  'confirmed',
                  'completed',
                  'cancelled',
                  'zelle_pending',
                ] as FilterKey[]
              ).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    filter === f ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {f === 'all'
                    ? 'Todas'
                    : f === 'zelle_pending'
                      ? 'Zelle Pendientes'
                      : STATUS_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar código, nombre, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Error banner */}
          {fetchError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Error cargando reservas:</strong> {fetchError}
              <button onClick={fetchBookings} className="ml-3 font-medium underline">
                Reintentar
              </button>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <p className="py-8 text-center text-neutral-500">Cargando reservas...</p>
          ) : filtered.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <CalendarCheck className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
              <p className="font-semibold">{search ? 'Sin resultados' : 'No hay reservas'}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => {
                const cfg = STATUS_CONFIG[b.booking_status] || STATUS_CONFIG.pending_emission;
                const isExpanded = expandedId === b.id;
                const profile = norm(b.profile);
                const flight = norm(b.flight);
                const offer = norm(b.offer);
                const isOfferBooking = !!b.offer_id;

                const isZellePending =
                  b.payment_method === 'zelle' && b.payment_status === 'pending_admin_approval';

                const isApproving = rowAction?.id === b.id && rowAction.kind === 'approve';
                const isRejecting = rowAction?.id === b.id && rowAction.kind === 'reject';

                return (
                  <Card key={b.id} variant="bordered" className="transition-all">
                    {/* Main row */}
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-brand-600">{b.booking_code}</span>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            <Badge variant={PAYMENT_VARIANT[b.payment_status] || 'warning'}>
                              {b.payment_status === 'pending_admin_approval' ? 'Zelle Pendiente' : b.payment_status}
                            </Badge>
                            {b.payment_method === 'zelle' && (
                              <Badge variant="info">Zelle</Badge>
                            )}
                            {isOfferBooking && (
                              <Badge variant="info">
                                <Tag className="mr-1 inline h-3 w-3" />
                                Oferta
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-neutral-600">
                            {profile?.full_name || 'Sin cliente'} · {routeSummary(b)} · {b.passengers?.length || 0} pax
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">${Number(b.total_amount).toFixed(2)}</p>
                          <p className="text-xs text-neutral-400">
                            {new Date(b.created_at).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-neutral-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-neutral-100 pt-4">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                          {/* Client */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Cliente</h4>
                            <p className="font-semibold">{profile?.full_name || '—'}</p>
                            <p className="text-sm text-neutral-600">{profile?.email || '—'}</p>
                            {profile?.phone && <p className="text-sm text-neutral-600">{profile.phone}</p>}
                            <p className="mt-1 text-xs text-neutral-400">
                              Puntos fidelidad: {profile?.loyalty_points || 0}
                            </p>
                          </div>

                          {/* Financial */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Financiero</h4>
                            <div className="space-y-1 text-sm">
                              {/* Flight booking financials */}
                              {flight && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Precio base:</span>
                                    <span>${Number(flight.base_price || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Markup ({flight.markup_percentage}%):</span>
                                    <span className="font-medium text-emerald-600">
                                      +${(Number(flight.final_price || 0) - Number(flight.base_price || 0)).toFixed(2)}
                                    </span>
                                  </div>
                                </>
                              )}

                              {/* Offer booking financials */}
                              {!flight && offer && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Precio original:</span>
                                    <span className="line-through text-neutral-400">
                                      ${Number(offer.original_price || 0).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-neutral-500">Precio oferta:</span>
                                    <span className="font-medium text-emerald-600">
                                      ${Number(offer.offer_price || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </>
                              )}

                              <div className="flex justify-between">
                                <span className="text-neutral-500">Subtotal ({b.passengers?.length || 0} pax):</span>
                                <span>${Number(b.subtotal || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Comisión pasarela:</span>
                                <span className="text-red-500">${Number(b.payment_gateway_fee || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 font-bold">
                                <span>Total cobrado:</span>
                                <span className="text-emerald-600">${Number(b.total_amount).toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-neutral-400">Método: {b.payment_method || '—'}</p>
                              {b.payment_gateway && (
                                <p className="text-xs text-neutral-400">Gateway: {b.payment_gateway}</p>
                              )}
                              {b.paid_at && (
                                <p className="text-xs text-neutral-400">
                                  Pagado: {new Date(b.paid_at).toLocaleString('es')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Passengers */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">
                              Pasajeros ({b.passengers?.length || 0})
                            </h4>
                            {(b.passengers || []).map((p, i) => (
                              <div key={p.id} className="mb-2 text-sm">
                                <p className="font-medium">
                                  {i + 1}. {p.first_name} {p.last_name}
                                </p>
                                {p.ticket_number && (
                                  <p className="font-mono text-xs text-neutral-500">Ticket: {p.ticket_number}</p>
                                )}
                              </div>
                            ))}
                            {b.airline_pnr && (
                              <p className="mt-2 text-xs text-neutral-500">
                                PNR Aerolínea: <strong className="font-mono">{b.airline_pnr}</strong>
                              </p>
                            )}

                            {/* Offer-specific info */}
                            {isOfferBooking && offer && (
                              <div className="mt-3 border-t border-neutral-200 pt-3">
                                <h5 className="mb-1 text-xs font-bold uppercase text-neutral-400">Info Oferta</h5>
                                <p className="text-sm font-medium">{offer.destination}</p>
                                {b.selected_date && (
                                  <p className="text-xs text-neutral-500">
                                    Fecha seleccionada: {new Date(b.selected_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </p>
                                )}
                                {offer.cabin_class && (
                                  <p className="text-xs text-neutral-500">Cabina: {offer.cabin_class}</p>
                                )}
                                {offer.departure_time && (
                                  <p className="text-xs text-neutral-500">
                                    Salida: {offer.departure_time}{offer.arrival_time ? ` → Llegada: ${offer.arrival_time}` : ''}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {/* Zelle actions */}
                          {isZellePending && (
                            <>
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => approveZelle(b.id)}
                                disabled={isApproving || isRejecting}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                {isApproving ? 'Aprobando...' : 'Aprobar Zelle'}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => rejectZelle(b.id)}
                                disabled={isApproving || isRejecting}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {isRejecting ? 'Rechazando...' : 'Rechazar Zelle'}
                              </Button>
                            </>
                          )}

                          {b.booking_status === 'pending_emission' && b.payment_status === 'paid' && (
                            <Link href="/admin/dashboard/emission">
                              <Button size="sm" className="gap-1.5">
                                <Plane className="h-3.5 w-3.5" /> Ir a Emitir <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}

                          {b.booking_status === 'confirmed' && (
                            <Button size="sm" variant="outline" onClick={() => markCompleted(b.id)} className="gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5" /> Marcar Completada
                            </Button>
                          )}

                          {!['cancelled', 'completed'].includes(b.booking_status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markCancelled(b.id)}
                              className="gap-1.5 text-red-600"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Cancelar Reserva
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
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
