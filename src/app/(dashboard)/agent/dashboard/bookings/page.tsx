//src/app/(dashboard)/agent/dashboard/bookings/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Search, Plane, Calendar, User, FileText, Download, DollarSign } from 'lucide-react';

type BadgeVariant =
  | 'default'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'info'
  | 'offer'
  | 'outline';

interface Booking {
  id: string;
  booking_code: string;
  created_at: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  voucher_pdf_url?: string | null;
  profile?: { full_name: string; email: string } | null;
  flight?: {
    airline?: { name: string } | null;
    origin_airport?: { iata_code: string } | null;
    destination_airport?: { iata_code: string } | null;
    departure_datetime: string;
  } | null;
}

const COMMISSION_RATE = 0.05;

export default function AgentBookingsPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<
    | 'all'
    | 'pending_emission'
    | 'confirmed'
    | 'emitted'
    | 'cancellation_requested'
    | 'cancelled'
    | 'completed'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('bookings')
      .select(
        `
        id, booking_code, created_at, booking_status, payment_status, total_amount, voucher_pdf_url,
        profile:profiles!user_id(full_name, email),
        flight:flights!flight_id(
          airline:airlines!airline_id(name),
          origin_airport:airports!origin_airport_id(iata_code),
          destination_airport:airports!destination_airport_id(iata_code),
          departure_datetime
        )
      `,
      )
      .eq('assigned_agent_id', user.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('booking_status', filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setBookings(data as unknown as Booking[]);
    }

    setLoading(false);
  }, [user, filter, supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = bookings.filter((b) => {
    const code = (b.booking_code ?? '').toLowerCase();
    const name = (b.profile?.full_name ?? '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return code.includes(q) || name.includes(q);
  });

  const getStatusColor = (status: string): BadgeVariant => {
    const map: Record<string, BadgeVariant> = {
      pending_emission: 'warning',
      confirmed: 'info',
      emitted: 'success',
      cancellation_requested: 'warning',
      cancelled: 'destructive',
      completed: 'default',
    };
    return map[status] ?? 'default';
  };

  const getStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      pending_emission: 'Pendiente Emisión',
      confirmed: 'Confirmada',
      emitted: 'Emitida',
      cancellation_requested: 'Cancelación Solicitada',
      cancelled: 'Cancelada',
      completed: 'Completada',
    };
    return map[status] ?? status;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Gestión de Reservas" subtitle="Historial completo de tus ventas" />

        <div className="p-8 space-y-6">
          {/* BARRA DE CONTROL */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            {/* Filtros */}
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {(
                [
                  'all',
                  'pending_emission',
                  'confirmed',
                  'emitted',
                  'cancellation_requested',
                  'cancelled',
                  'completed',
                ] as const
              ).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    filter === f ? 'bg-brand-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'Todas' : getStatusLabel(f)}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cliente o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          {/* LISTA DE RESERVAS */}
          {loading ? (
            <div className="text-center py-20 text-gray-500">Cargando ventas...</div>
          ) : filteredBookings.length === 0 ? (
            <Card className="text-center py-16 flex flex-col items-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No se encontraron reservas</h3>
              <p className="text-gray-500">Intenta cambiar los filtros o realizar una nueva venta.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredBookings.map((booking) => (
                <Card key={booking.id} className="p-5 hover:border-brand-300 transition group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info Principal */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl hidden sm:block">
                        <Plane className="h-6 w-6" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-gray-900">{booking.booking_code}</span>
                          <Badge variant={getStatusColor(booking.booking_status)}>
                            {getStatusLabel(booking.booking_status)}
                          </Badge>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User size={14} /> {booking.profile?.full_name || 'Sin nombre'}
                          </span>

                          {booking.flight?.departure_datetime ? (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {new Date(booking.flight.departure_datetime).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Ruta y Precio */}
                    <div className="flex flex-col md:items-end gap-1">
                      {booking.flight?.origin_airport?.iata_code && booking.flight?.destination_airport?.iata_code ? (
                        <div className="font-medium text-gray-800 flex items-center gap-2">
                          {booking.flight.origin_airport.iata_code}
                          <span className="text-gray-400">➝</span>
                          {booking.flight.destination_airport.iata_code}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Vuelo no disponible</span>
                      )}

                      <div className="font-bold text-lg text-emerald-700">
                        ${Number(booking.total_amount ?? 0).toLocaleString()}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-xs text-gray-500">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span>
                          Comisión Estimada:{' '}
                          <span className="font-semibold text-emerald-700">
                            ${ (Number(booking.total_amount ?? 0) * COMMISSION_RATE).toFixed(2) }
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    {booking.voucher_pdf_url ? (
                      <a
                        href={booking.voucher_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100"
                      >
                        <Download className="h-4 w-4" />
                        Descargar Voucher
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Voucher no disponible</span>
                    )}

                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-800 transition"
                    >
                      Ver detalles completos →
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                Reserva {selectedBooking.booking_code}
              </h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Estado</span>
                <Badge variant={getStatusColor(selectedBooking.booking_status)}>
                  {getStatusLabel(selectedBooking.booking_status)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente</span>
                <span className="font-medium">{selectedBooking.profile?.full_name || 'Sin nombre'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{selectedBooking.profile?.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ruta</span>
                <span className="font-medium">
                  {selectedBooking.flight?.origin_airport?.iata_code} ➝ {selectedBooking.flight?.destination_airport?.iata_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha vuelo</span>
                <span className="font-medium">
                  {selectedBooking.flight?.departure_datetime
                    ? new Date(selectedBooking.flight.departure_datetime).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Aerolínea</span>
                <span className="font-medium">{selectedBooking.flight?.airline?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado pago</span>
                <span className="font-medium">{selectedBooking.payment_status || '—'}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700 font-semibold">Total</span>
                <span className="font-bold text-emerald-700">${Number(selectedBooking.total_amount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Comisión estimada (5%)</span>
                <span className="font-semibold text-emerald-700">
                  ${(Number(selectedBooking.total_amount ?? 0) * COMMISSION_RATE).toFixed(2)}
                </span>
              </div>
            </div>
            {selectedBooking.voucher_pdf_url && (
              <a
                href={selectedBooking.voucher_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
              >
                <Download className="h-4 w-4" /> Descargar Voucher
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
