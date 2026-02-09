/**
 * @fileoverview Agent Assigned Bookings — Full view of bookings assigned to agent.
 * Per spec §2.2: Agent manages assigned bookings, contacts clients via platform.
 * Supports URL params: ?filter=pending_emission&selected=<booking_id>
 * @module app/(dashboard)/agent/dashboard/bookings/page
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  Plane, Search, ChevronDown, ChevronUp, User, Mail, Phone,
  DollarSign, Calendar, Clock, CheckCircle, 
  MapPin, Users as UsersIcon,
} from 'lucide-react';

type FilterType = 'all' | 'pending_emission' | 'confirmed' | 'completed' | 'cancelled';

interface AgentBooking {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  subtotal: number;
  payment_gateway_fee: number;
  total_amount: number;
  payment_method: string | null;
  airline_pnr: string | null;
  created_at: string;
  emitted_at: string | null;
  profile?: { full_name: string; email: string; phone: string | null } | null;
  flight?: {
    flight_number: string;
    departure_datetime: string;
    arrival_datetime: string;
    base_price: number;
    markup_percentage: number;
    final_price: number;
    aircraft_type: string | null;
    airline: { name: string; iata_code: string } | null;
    origin_airport: { iata_code: string; city: string; name: string } | null;
    destination_airport: { iata_code: string; city: string; name: string } | null;
  } | null;
  passengers?: {
    id: string;
    first_name: string;
    last_name: string;
    ticket_number: string | null;
  }[];
}

const FILTERS: { value: FilterType; label: string; color: string }[] = [
  { value: 'all', label: 'Todas', color: 'bg-neutral-100 text-neutral-700' },
  { value: 'pending_emission', label: 'Pendiente Emisión', color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed', label: 'Confirmadas', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'completed', label: 'Completadas', color: 'bg-blue-100 text-blue-700' },
  { value: 'cancelled', label: 'Canceladas', color: 'bg-red-100 text-red-700' },
];

export default function AgentBookingsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const initialSelected = searchParams.get('selected') || null;

  const [bookings, setBookings] = useState<AgentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(initialSelected);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_code, booking_status, payment_status, subtotal,
        payment_gateway_fee, total_amount, payment_method, airline_pnr,
        created_at, emitted_at,
        profile:profiles!user_id(full_name, email, phone),
        flight:flights!flight_id(
          flight_number, departure_datetime, arrival_datetime,
          base_price, markup_percentage, final_price, aircraft_type,
          airline:airlines!airline_id(name, iata_code),
          origin_airport:airports!origin_airport_id(iata_code, city, name),
          destination_airport:airports!destination_airport_id(iata_code, city, name)
        ),
        passengers:booking_passengers(id, first_name, last_name, ticket_number)
      `)
      .eq('assigned_agent_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setBookings(data as unknown as AgentBooking[] || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  /* ── Filters ── */
  const filtered = bookings
    .filter(b => filter === 'all' || b.booking_status === filter)
    .filter(b => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.booking_code.toLowerCase().includes(q) ||
        b.profile?.full_name.toLowerCase().includes(q) ||
        b.profile?.email.toLowerCase().includes(q) ||
        b.flight?.flight_number.toLowerCase().includes(q) ||
        b.airline_pnr?.toLowerCase().includes(q) ||
        b.flight?.origin_airport?.city.toLowerCase().includes(q) ||
        b.flight?.destination_airport?.city.toLowerCase().includes(q)
      );
    });

  /* ── Summary Stats ── */
  const summaryStats = {
    total: bookings.length,
    pending: bookings.filter(b => b.booking_status === 'pending_emission').length,
    confirmed: bookings.filter(b => b.booking_status === 'confirmed').length,
    revenue: bookings
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + Number(b.total_amount), 0),
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'warning' | 'success' | 'default' | 'destructive' | 'info'> = {
      pending_emission: 'warning', confirmed: 'success', completed: 'info', cancelled: 'destructive',
    };
    return map[status] || 'default';
  };

  const statusLabel: Record<string, string> = {
    pending_emission: 'Pendiente Emisión', confirmed: 'Confirmada',
    completed: 'Completada', cancelled: 'Cancelada',
  };

  const paymentLabel: Record<string, string> = {
    paid: 'Pagado', pending: 'Pendiente', failed: 'Fallido', refunded: 'Reembolsado',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Reservas Asignadas"
          subtitle="Reservas de clientes asignadas a tu gestión"
        />
        <div className="p-8 space-y-6">

          {/* ── Summary ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total', value: summaryStats.total, icon: CalendarCheck, color: 'text-brand-600 bg-brand-50' },
              { label: 'Pend. Emisión', value: summaryStats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Confirmadas', value: summaryStats.confirmed, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Ingresos', value: `$${summaryStats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-violet-600 bg-violet-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} variant="bordered">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] text-neutral-500">{label}</p>
                    <p className="text-lg font-bold text-neutral-900">{loading ? '—' : value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Filters + Search ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    filter === f.value
                      ? `${f.color} ring-2 ring-offset-1 ring-neutral-300`
                      : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {f.label}
                  {f.value !== 'all' && (
                    <span className="ml-1 opacity-70">
                      ({bookings.filter(b => b.booking_status === f.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar código, cliente, ruta..."
                className="w-full rounded-xl border border-neutral-300 pl-10 pr-4 py-2 text-sm sm:w-72"
              />
            </div>
          </div>

          {/* ── Bookings List ── */}
          {loading ? (
            <Card variant="bordered" className="text-center py-10">
              <p className="text-neutral-400">Cargando reservas...</p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card variant="bordered" className="text-center py-10">
              <Plane className="mx-auto h-10 w-10 text-neutral-200 mb-3" />
              <p className="text-neutral-500">
                {searchQuery ? 'No se encontraron reservas con esa búsqueda' : 'No hay reservas con este filtro'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(b => {
                const isExpanded = expandedId === b.id;
                const flight = b.flight;
                const passengerCount = b.passengers?.length || 0;

                return (
                  <Card key={b.id} variant="bordered" className={isExpanded ? 'ring-2 ring-brand-200' : ''}>
                    {/* ── Row Header ── */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : b.id)}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                          <Plane className="h-5 w-5 text-brand-600" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900">{b.booking_code}</span>
                            <Badge variant={statusBadge(b.booking_status)}>
                              {statusLabel[b.booking_status] || b.booking_status}
                            </Badge>
                            {b.airline_pnr && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                PNR: {b.airline_pnr}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 truncate">
                            {b.profile?.full_name || 'Sin cliente'} ·{' '}
                            {flight
                              ? `${flight.origin_airport?.iata_code} → ${flight.destination_airport?.iata_code}`
                              : 'Sin vuelo'
                            }
                            {flight?.airline?.name && ` · ${flight.airline.name}`}
                            {passengerCount > 0 && ` · ${passengerCount} pasajero${passengerCount > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-neutral-900">
                            ${Number(b.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {new Date(b.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-neutral-400" /> : <ChevronDown className="h-5 w-5 text-neutral-400" />}
                      </div>
                    </button>

                    {/* ── Expanded Detail ── */}
                    {isExpanded && (
                      <div className="mt-4 border-t border-neutral-100 pt-4">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          {/* Client Info */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                              <User className="h-4 w-4 text-brand-500" /> Datos del Cliente
                            </h4>
                            <div className="rounded-xl bg-neutral-50 p-4 space-y-2 text-sm">
                              <p className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-neutral-400" />
                                <span className="font-medium">{b.profile?.full_name || '—'}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-neutral-400" />
                                <span>{b.profile?.email || '—'}</span>
                              </p>
                              {b.profile?.phone && (
                                <p className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5 text-neutral-400" />
                                  <span>{b.profile.phone}</span>
                                </p>
                              )}
                            </div>

                            {/* Flight Info */}
                            {flight && (
                              <>
                                <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2 mt-4">
                                  <Plane className="h-4 w-4 text-brand-500" /> Información del Vuelo
                                </h4>
                                <div className="rounded-xl bg-neutral-50 p-4 space-y-2 text-sm">
                                  <p>
                                    <span className="font-medium">{flight.airline?.name}</span> — {flight.flight_number}
                                  </p>
                                  <div className="flex items-center gap-3">
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-neutral-900">{flight.origin_airport?.iata_code}</p>
                                      <p className="text-[10px] text-neutral-500">{flight.origin_airport?.city}</p>
                                    </div>
                                    <div className="flex-1 border-t border-dashed border-neutral-300" />
                                    <MapPin className="h-4 w-4 text-brand-500" />
                                    <div className="flex-1 border-t border-dashed border-neutral-300" />
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-neutral-900">{flight.destination_airport?.iata_code}</p>
                                      <p className="text-[10px] text-neutral-500">{flight.destination_airport?.city}</p>
                                    </div>
                                  </div>
                                  <p className="flex items-center gap-2 text-xs text-neutral-500">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(flight.departure_datetime).toLocaleDateString('es', {
                                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                    })}
                                  </p>
                                  {flight.aircraft_type && (
                                    <p className="text-xs text-neutral-500">Aeronave: {flight.aircraft_type}</p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Financial + Passengers */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-emerald-500" /> Desglose Financiero
                            </h4>
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-neutral-600">Subtotal</span>
                                <span className="font-medium">${Number(b.subtotal).toFixed(2)}</span>
                              </div>
                              {Number(b.payment_gateway_fee) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-neutral-600">Comisión pasarela</span>
                                  <span className="font-medium">${Number(b.payment_gateway_fee).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t border-emerald-300 pt-1 font-bold">
                                <span>Total cobrado</span>
                                <span className="text-emerald-700">${Number(b.total_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-neutral-500">Método de pago</span>
                                <span className="capitalize">{b.payment_method || '—'}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-neutral-500">Estado de pago</span>
                                <Badge variant={b.payment_status === 'paid' ? 'success' : 'warning'} className="text-[10px]">
                                  {paymentLabel[b.payment_status] || b.payment_status}
                                </Badge>
                              </div>
                              {b.emitted_at && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-neutral-500">Emitido</span>
                                  <span>{new Date(b.emitted_at).toLocaleDateString('es')}</span>
                                </div>
                              )}
                            </div>

                            {/* Passengers */}
                            {b.passengers && b.passengers.length > 0 && (
                              <>
                                <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2 mt-4">
                                  <UsersIcon className="h-4 w-4 text-violet-500" /> Pasajeros ({b.passengers.length})
                                </h4>
                                <div className="rounded-xl bg-neutral-50 p-4 space-y-2">
                                  {b.passengers.map((p, i) => (
                                    <div key={p.id} className="flex items-center justify-between text-sm">
                                      <span>
                                        <span className="text-neutral-400 mr-2">{i + 1}.</span>
                                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                                      </span>
                                      {p.ticket_number ? (
                                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-mono text-emerald-700">
                                          {p.ticket_number}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-neutral-400">Sin ticket</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            {/* PNR Display */}
                            {b.airline_pnr && (
                              <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 text-center">
                                <p className="text-xs text-brand-600 mb-1">PNR de Aerolínea</p>
                                <p className="text-2xl font-mono font-bold text-brand-700 tracking-widest">{b.airline_pnr}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Count */}
          {!loading && (
            <p className="text-xs text-neutral-400 text-center">
              Mostrando {filtered.length} de {bookings.length} reservas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
