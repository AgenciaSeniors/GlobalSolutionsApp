/**
 * @fileoverview Admin All Bookings — Master CRM table.
 * Per spec §2.3: "Database of clients with purchase history and frequency for analysis."
 *
 * Features:
 * - Filter by status (all, pending, confirmed, completed, cancelled)
 * - Search by booking code, client name, email
 * - Expandable detail with passenger data
 * - Quick action: link to emission, mark as completed, cancel
 * - Export summary
 */
'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

/* ---------- Types ---------- */
interface BookingRow {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: number;
  subtotal: number;
  payment_gateway_fee: number;
  airline_pnr: string | null;
  created_at: string;
  paid_at: string | null;
  return_date: string | null;
  emitted_at: string | null;
  profile: { full_name: string; email: string; phone: string | null; loyalty_points: number } | null;
  flight: {
    flight_number: string;
    departure_datetime: string;
    base_price: number;
    final_price: number;
    markup_percentage: number;
    airline: { name: string; iata_code: string } | null;
    origin_airport: { iata_code: string; city: string } | null;
    destination_airport: { iata_code: string; city: string } | null;
  } | null;
  passengers: { id: string; first_name: string; last_name: string; ticket_number: string | null }[];
}

const STATUS_CONFIG: Record<string, { variant: 'warning' | 'success' | 'error' | 'info'; label: string; icon: typeof Clock }> = {
  pending_emission: { variant: 'warning', label: 'Pendiente Emisión', icon: Clock },
  confirmed: { variant: 'success', label: 'Emitida', icon: CheckCircle },
  completed: { variant: 'info', label: 'Completada', icon: CalendarCheck },
  cancelled: { variant: 'error', label: 'Cancelada', icon: XCircle },
};

const PAYMENT_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  refunded: 'error',
};

export default function AdminBookingsPage() {
  const supabase = createClient();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function fetchBookings() {
    setLoading(true);
    let query = supabase
      .from('bookings')
      .select(`
        id, booking_code, booking_status, payment_status, payment_method,
        total_amount, subtotal, payment_gateway_fee, airline_pnr,
        created_at, paid_at, return_date, emitted_at,
        profile:profiles!user_id(full_name, email, phone, loyalty_points),
        flight:flights(
          flight_number, departure_datetime, base_price, final_price, markup_percentage,
          airline:airlines(name, iata_code),
          origin_airport:airports!origin_airport_id(iata_code, city),
          destination_airport:airports!destination_airport_id(iata_code, city)
        ),
        passengers:booking_passengers(id, first_name, last_name, ticket_number)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter !== 'all') {
      query = query.eq('booking_status', filter);
    }

    const { data } = await query;
    setBookings((data as unknown as BookingRow[]) || []);
    setLoading(false);
  }

  /* ---------- Actions ---------- */
  async function markCompleted(id: string) {
    if (!confirm('¿Marcar esta reserva como completada (viaje finalizado)?')) return;
    await supabase.from('bookings').update({ booking_status: 'completed' }).eq('id', id);
    fetchBookings();
  }

  async function markCancelled(id: string) {
    if (!confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    await supabase.from('bookings').update({ booking_status: 'cancelled' }).eq('id', id);
    fetchBookings();
  }

  /* ---------- Filtered ---------- */
  const filtered = bookings.filter((b) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      b.booking_code.toLowerCase().includes(s) ||
      b.profile?.full_name.toLowerCase().includes(s) ||
      b.profile?.email.toLowerCase().includes(s) ||
      b.airline_pnr?.toLowerCase().includes(s) ||
      b.flight?.flight_number.toLowerCase().includes(s)
    );
  });

  /* ---------- Summary stats ---------- */
  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + b.total_amount, 0);
  const totalProfit = bookings
    .filter((b) => b.payment_status === 'paid' && b.flight)
    .reduce((sum, b) => {
      const markup = (b.flight?.final_price || 0) - (b.flight?.base_price || 0);
      return sum + markup * b.passengers.length;
    }, 0);

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
              <p className="text-2xl font-bold text-emerald-600">${totalRevenue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </Card>
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Ganancia por Markup</p>
              <p className="text-2xl font-bold text-brand-600">${totalProfit.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </Card>
            <Card variant="bordered">
              <p className="text-xs text-neutral-500">Pasajeros Totales</p>
              <p className="text-2xl font-bold">{bookings.reduce((s, b) => s + b.passengers.length, 0)}</p>
            </Card>
          </div>

          {/* Filters + Search */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending_emission', 'confirmed', 'completed', 'cancelled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-brand-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {f === 'all' ? 'Todas' : STATUS_CONFIG[f]?.label || f}
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

                return (
                  <Card key={b.id} variant="bordered" className="transition-all">
                    {/* Main row */}
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-brand-600">{b.booking_code}</span>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            <Badge variant={PAYMENT_VARIANT[b.payment_status] || 'warning'}>{b.payment_status}</Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-neutral-600">
                            {b.profile?.full_name} · {b.flight?.airline?.iata_code} {b.flight?.flight_number} ·{' '}
                            {b.flight?.origin_airport?.iata_code} → {b.flight?.destination_airport?.iata_code} ·{' '}
                            {b.passengers.length} pax
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">${b.total_amount.toFixed(2)}</p>
                          <p className="text-xs text-neutral-400">
                            {new Date(b.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-neutral-400" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-neutral-100 pt-4">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                          {/* Client */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Cliente</h4>
                            <p className="font-semibold">{b.profile?.full_name}</p>
                            <p className="text-sm text-neutral-600">{b.profile?.email}</p>
                            {b.profile?.phone && <p className="text-sm text-neutral-600">{b.profile.phone}</p>}
                            <p className="mt-1 text-xs text-neutral-400">Puntos fidelidad: {b.profile?.loyalty_points || 0}</p>
                          </div>

                          {/* Financial */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">Financiero</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Precio base:</span>
                                <span>${b.flight?.base_price.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Markup ({b.flight?.markup_percentage}%):</span>
                                <span className="text-emerald-600 font-medium">+${((b.flight?.final_price || 0) - (b.flight?.base_price || 0)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Subtotal ({b.passengers.length} pax):</span>
                                <span>${b.subtotal?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Comisión pasarela:</span>
                                <span className="text-red-500">${b.payment_gateway_fee?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 font-bold">
                                <span>Total cobrado:</span>
                                <span className="text-emerald-600">${b.total_amount.toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-neutral-400">Método: {b.payment_method || '—'}</p>
                            </div>
                          </div>

                          {/* Passengers */}
                          <div className="rounded-lg bg-neutral-50 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">
                              Pasajeros ({b.passengers.length})
                            </h4>
                            {b.passengers.map((p, i) => (
                              <div key={p.id} className="mb-2 text-sm">
                                <p className="font-medium">{i + 1}. {p.first_name} {p.last_name}</p>
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
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex flex-wrap gap-3">
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
                            <Button size="sm" variant="ghost" onClick={() => markCancelled(b.id)} className="gap-1.5 text-red-600">
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
