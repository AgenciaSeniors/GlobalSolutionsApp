/**
 * @fileoverview Admin Emission Panel — Complete ticket issuance flow.
 *
 * Spec §6 Process:
 *  1. Client pays → booking_status = 'pending_emission', payment_status = 'paid'
 *  2. Admin receives alert in this panel
 *  3. Admin buys real ticket in airline system
 *  4. Admin enters: airline PNR + ticket number per passenger
 *  5. System marks as confirmed + stores emission timestamp
 *  6. Client receives notification (<24h SLA)
 *
 * Spec §6.1 Identifiers:
 *  - PNR (airline confirmation code, e.g. XYZ123)
 *  - Ticket Number (per passenger, e.g. 235-1234567890)
 *  - Internal Booking Code (e.g. GST-ABC123)
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  Plane,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

/* ---------- Types ---------- */
interface PassengerRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  ticket_number: string | null;
}

interface PendingBooking {
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
  profile: { full_name: string; email: string; phone: string | null } | null;
  flight: {
    flight_number: string;
    departure_datetime: string;
    arrival_datetime: string;
    base_price: number;
    markup_percentage: number;
    final_price: number;
    aircraft_type: string | null;
    baggage_included: string | null;
    airline: { name: string; iata_code: string } | null;
    origin_airport: { iata_code: string; city: string; name: string } | null;
    destination_airport: { iata_code: string; city: string; name: string } | null;
  } | null;
  passengers: PassengerRow[];
}

/* ---------- Helpers ---------- */
function hoursElapsed(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000);
}

function slaColor(hours: number, warningHours: number, slaHours: number): string {
  if (hours >= slaHours - 4) return 'text-red-600 bg-red-50';
  if (hours >= warningHours) return 'text-amber-600 bg-amber-50';
  return 'text-emerald-600 bg-emerald-50';
}

function slaLabel(hours: number, slaHours: number): string {
  const remaining = slaHours - hours;
  if (remaining <= 0) return `⚠️ SLA VENCIDO (${hours}h)`;
  return `${remaining}h restantes`;
}

/* ---------- Component ---------- */
export default function EmissionPage() {
  const supabase = createClient();
  const { settings } = useAppSettings();
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Emission form state
  const [pnr, setPnr] = useState('');
  const [ticketNumbers, setTicketNumbers] = useState<Record<string, string>>({});
  const [emitting, setEmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select(`
        id, booking_code, booking_status, payment_status, payment_method,
        total_amount, subtotal, payment_gateway_fee, airline_pnr,
        created_at, paid_at,
        profile:profiles!user_id(full_name, email, phone),
        flight:flights(
          flight_number, departure_datetime, arrival_datetime,
          base_price, markup_percentage, final_price,
          aircraft_type, baggage_included,
          airline:airlines(name, iata_code),
          origin_airport:airports!origin_airport_id(iata_code, city, name),
          destination_airport:airports!destination_airport_id(iata_code, city, name)
        ),
        passengers:booking_passengers(id, first_name, last_name, date_of_birth, nationality, ticket_number)
      `)
      .eq('payment_status', 'paid')
      .in('booking_status', ['pending_emission', 'confirmed'])
      .order('created_at', { ascending: true });

    setBookings((data as unknown as PendingBooking[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  /* ---------- Toggle expand ---------- */
  function toggleExpand(booking: PendingBooking) {
    if (expandedId === booking.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(booking.id);
    setPnr(booking.airline_pnr || '');
    const tickets: Record<string, string> = {};
    booking.passengers.forEach((p) => {
      tickets[p.id] = p.ticket_number || '';
    });
    setTicketNumbers(tickets);
    setSuccessMsg('');
    setErrorMsg('');
  }

  /* ---------- Emit ---------- */
  async function handleEmit(booking: PendingBooking) {
    if (!pnr.trim()) {
      setErrorMsg('El PNR de la aerolínea es obligatorio.');
      return;
    }

    // Validate at least one ticket number
    const hasTickets = Object.values(ticketNumbers).some((t) => t.trim());
    if (!hasTickets) {
      setErrorMsg('Ingresa al menos un número de ticket.');
      return;
    }

    setEmitting(true);
    setErrorMsg('');

    try {
      // 1. Update booking
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({
          airline_pnr: pnr.trim().toUpperCase(),
          booking_status: 'confirmed',
          emitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (bookingErr) throw bookingErr;

      // 2. Update each passenger ticket number
      for (const [passId, ticketNum] of Object.entries(ticketNumbers)) {
        if (ticketNum.trim()) {
          const { error: passErr } = await supabase
            .from('booking_passengers')
            .update({ ticket_number: ticketNum.trim() })
            .eq('id', passId);

          if (passErr) throw passErr;
        }
      }

      setSuccessMsg(
        `✅ Reserva ${booking.booking_code} emitida exitosamente — PNR: ${pnr.trim().toUpperCase()}`
      );
      setExpandedId(null);
      fetchBookings();
    } catch (err: unknown) {
      setErrorMsg(
        `Error al emitir: ${err instanceof Error ? err.message : 'Intente de nuevo'}`
      );
    } finally {
      setEmitting(false);
    }
  }

  /* ---------- Stats ---------- */
  const warningH = settings.emission_warning_hours;
  const slaH = settings.emission_sla_hours;
  const pendingCount = bookings.filter((b) => b.booking_status === 'pending_emission').length;
  const confirmedCount = bookings.filter((b) => b.booking_status === 'confirmed').length;
  const urgentCount = bookings.filter(
    (b) => b.booking_status === 'pending_emission' && hoursElapsed(b.created_at) >= warningH
  ).length;
  const criticalCount = bookings.filter(
    (b) => b.booking_status === 'pending_emission' && hoursElapsed(b.created_at) >= (slaH - 4)
  ).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header
          title="Emisión de Boletos"
          subtitle={`Reservas pagadas pendientes de emisión — SLA: ${settings.emission_sla_hours} horas`}
        />
        <div className="p-6 lg:p-8">
          {/* Success message */}
          {successMsg && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card variant="bordered" className={criticalCount > 0 ? 'border-red-300 bg-red-50/50' : ''}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-8 w-8 ${criticalCount > 0 ? 'text-red-500' : 'text-neutral-300'}`} />
                <div>
                  <p className="text-xs text-neutral-500">SLA Crítico ({'>'}{slaH - 4}h)</p>
                  <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-neutral-300'}`}>
                    {criticalCount}
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="bordered" className={urgentCount > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
              <div className="flex items-center gap-3">
                <Clock className={`h-8 w-8 ${urgentCount > 0 ? 'text-amber-500' : 'text-neutral-300'}`} />
                <div>
                  <p className="text-xs text-neutral-500">Urgentes ({'>'}{warningH}h)</p>
                  <p className={`text-2xl font-bold ${urgentCount > 0 ? 'text-amber-600' : 'text-neutral-300'}`}>
                    {urgentCount}
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-brand-500" />
                <div>
                  <p className="text-xs text-neutral-500">Pendientes</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </Card>
            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-xs text-neutral-500">Emitidas (recientes)</p>
                  <p className="text-2xl font-bold text-emerald-600">{confirmedCount}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Refresh */}
          <div className="mb-4 flex justify-end">
            <Button size="sm" variant="ghost" onClick={fetchBookings} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </Button>
          </div>

          {/* Booking List */}
          {loading ? (
            <div className="py-12 text-center text-neutral-500">Cargando reservas pendientes...</div>
          ) : bookings.filter((b) => b.booking_status === 'pending_emission').length === 0 ? (
            <Card variant="bordered" className="py-16 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
              <p className="text-xl font-bold text-neutral-700">¡Todo al día!</p>
              <p className="mt-1 text-sm text-neutral-500">
                No hay reservas pendientes de emisión.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {bookings
                .filter((b) => b.booking_status === 'pending_emission')
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((booking) => {
                  const hours = hoursElapsed(booking.created_at);
                  const isExpanded = expandedId === booking.id;

                  return (
                    <Card
                      key={booking.id}
                      variant="bordered"
                      className={`transition-all ${
                        hours >= (slaH - 4)
                          ? 'border-red-300 bg-red-50/30'
                          : hours >= warningH
                            ? 'border-amber-300 bg-amber-50/30'
                            : ''
                      }`}
                    >
                      {/* Collapsed Row */}
                      <button
                        onClick={() => toggleExpand(booking)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-4">
                          {/* SLA Timer */}
                          <div
                            className={`flex h-12 w-20 flex-col items-center justify-center rounded-xl text-xs font-bold ${slaColor(hours, warningH, slaH)}`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span>{slaLabel(hours, slaH)}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-brand-600">
                                {booking.booking_code}
                              </span>
                              <Badge variant="warning">Pendiente</Badge>
                            </div>
                            <p className="mt-0.5 text-sm text-neutral-600">
                              {booking.profile?.full_name} ·{' '}
                              {booking.flight?.airline?.iata_code} {booking.flight?.flight_number} ·{' '}
                              {booking.flight?.origin_airport?.iata_code} →{' '}
                              {booking.flight?.destination_airport?.iata_code}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-bold">${booking.total_amount.toFixed(2)}</p>
                            <p className="text-xs text-neutral-400">
                              {booking.passengers.length} pasajero{booking.passengers.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-neutral-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-neutral-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="mt-5 border-t border-neutral-200 pt-5">
                          {errorMsg && (
                            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                              {errorMsg}
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {/* LEFT: Booking Info */}
                            <div className="space-y-4">
                              {/* Client Contact */}
                              <div className="rounded-xl bg-neutral-50 p-4">
                                <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">
                                  Datos del Cliente
                                </h4>
                                <p className="font-semibold">{booking.profile?.full_name}</p>
                                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                                  <Mail className="h-3.5 w-3.5" /> {booking.profile?.email}
                                </p>
                                {booking.profile?.phone && (
                                  <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                                    <Phone className="h-3.5 w-3.5" /> {booking.profile.phone}
                                  </p>
                                )}
                              </div>

                              {/* Flight Info */}
                              <div className="rounded-xl bg-neutral-50 p-4">
                                <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">
                                  Detalle del Vuelo
                                </h4>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                  <span className="text-neutral-500">Aerolínea:</span>
                                  <span className="font-medium">{booking.flight?.airline?.name}</span>
                                  <span className="text-neutral-500">Vuelo:</span>
                                  <span className="font-mono font-medium">{booking.flight?.flight_number}</span>
                                  <span className="text-neutral-500">Ruta:</span>
                                  <span className="font-medium">
                                    {booking.flight?.origin_airport?.city} ({booking.flight?.origin_airport?.iata_code})
                                    → {booking.flight?.destination_airport?.city} ({booking.flight?.destination_airport?.iata_code})
                                  </span>
                                  <span className="text-neutral-500">Salida:</span>
                                  <span className="font-medium">
                                    {booking.flight?.departure_datetime
                                      ? new Date(booking.flight.departure_datetime).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
                                      : '—'}
                                  </span>
                                  <span className="text-neutral-500">Aeronave:</span>
                                  <span>{booking.flight?.aircraft_type || '—'}</span>
                                  <span className="text-neutral-500">Equipaje:</span>
                                  <span>{booking.flight?.baggage_included || '—'}</span>
                                </div>
                              </div>

                              {/* Payment */}
                              <div className="rounded-xl bg-neutral-50 p-4">
                                <h4 className="mb-2 text-xs font-bold uppercase text-neutral-400">
                                  Desglose Financiero
                                </h4>
                                <div className="grid grid-cols-2 gap-y-1 text-sm">
                                  <span className="text-neutral-500">Subtotal:</span>
                                  <span>${booking.subtotal?.toFixed(2)}</span>
                                  <span className="text-neutral-500">Comisión pasarela:</span>
                                  <span>${booking.payment_gateway_fee?.toFixed(2)}</span>
                                  <span className="font-bold text-neutral-800">Total cobrado:</span>
                                  <span className="font-bold text-emerald-600">${booking.total_amount.toFixed(2)}</span>
                                  <span className="text-neutral-500">Método:</span>
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" /> {booking.payment_method || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* RIGHT: Emission Form */}
                            <div className="space-y-4">
                              <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-5">
                                <h4 className="mb-4 flex items-center gap-2 font-bold text-brand-800">
                                  <Plane className="h-5 w-5" /> Datos de Emisión
                                </h4>

                                {/* FIX: Input no soporta prop `label` */}
                                <div className="space-y-1">
                                  <label
                                    htmlFor="airline_pnr"
                                    className="mb-1 block text-sm font-medium text-neutral-700"
                                  >
                                    PNR de la Aerolínea (Código de Confirmación)
                                  </label>
                                  <Input
                                    id="airline_pnr"
                                    placeholder="Ej: ABCDEF"
                                    value={pnr}
                                    onChange={(e) => setPnr(e.target.value.toUpperCase())}
                                    required
                                  />
                                </div>

                                <div className="mt-4 space-y-3">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                                    <Users className="h-4 w-4" />
                                    Nº de Ticket por Pasajero ({booking.passengers.length})
                                  </p>
                                  {booking.passengers.map((p, idx) => (
                                    <div key={p.id}>
                                      <label className="mb-1 block text-xs text-neutral-500">
                                        Pasajero {idx + 1}: {p.first_name} {p.last_name}
                                        <span className="ml-2 text-neutral-400">
                                          ({p.nationality} · {new Date(p.date_of_birth).toLocaleDateString('es')})
                                        </span>
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="Ej: 235-1234567890"
                                        value={ticketNumbers[p.id] || ''}
                                        onChange={(e) =>
                                          setTicketNumbers((prev) => ({
                                            ...prev,
                                            [p.id]: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded-xl border-2 border-neutral-200 bg-white px-4 py-2.5 font-mono text-sm focus:border-brand-500 focus:outline-none"
                                      />
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-6 flex gap-3">
                                  <Button
                                    onClick={() => handleEmit(booking)}
                                    isLoading={emitting}
                                    className="flex-1 gap-2"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Confirmar Emisión
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setExpandedId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}

          {/* Recently Emitted */}
          {bookings.filter((b) => b.booking_status === 'confirmed').length > 0 && (
            <div className="mt-10">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">
                Emitidas Recientemente
              </h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Vuelo</th>
                      <th className="px-4 py-3">PNR</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {bookings
                      .filter((b) => b.booking_status === 'confirmed')
                      .map((b) => (
                        <tr key={b.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-mono font-bold text-brand-600">
                            {b.booking_code}
                          </td>
                          <td className="px-4 py-3">{b.profile?.full_name}</td>
                          <td className="px-4 py-3">
                            {b.flight?.origin_airport?.iata_code} → {b.flight?.destination_airport?.iata_code}
                          </td>
                          <td className="px-4 py-3 font-mono">{b.airline_pnr}</td>
                          <td className="px-4 py-3 font-semibold">${b.total_amount.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="success">Emitida</Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
