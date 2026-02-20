/**
 * @fileoverview Admin Emission Panel — Ticket issuance + Voucher upload (PDF).
 *
 * FIX A3:
 * - Show PAID bookings that still have no voucher/ticket emitted (pending_emission OR confirmed but missing voucher)
 * - Modal form: PNR + upload official PDF + (optional) ticket numbers per passenger
 * - Mark status to EMITTED (tries 'emitted' then falls back to 'confirmed' for compatibility)
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  Plane,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
  Phone,
  CreditCard,
  RefreshCw,
  Upload,
  Download,
} from 'lucide-react';

/* ---------- Config ---------- */
const VOUCHERS_BUCKET = 'vouchers';

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
  voucher_pdf_url: string | null;
  emitted_at: string | null;
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

function isPaid(paymentStatus: string | null | undefined) {
  const v = String(paymentStatus ?? '').toLowerCase();
  return v === 'paid';
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

  // Modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PendingBooking | null>(null);

  // Form state
  const [pnr, setPnr] = useState('');
  const [ticketNumbers, setTicketNumbers] = useState<Record<string, string>>({});
  const [voucherFile, setVoucherFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchBookings = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('bookings')
      .select(
        `
        id, booking_code, booking_status, payment_status, payment_method,
        total_amount, subtotal, payment_gateway_fee,
        airline_pnr, voucher_pdf_url, emitted_at,
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
      `,
      )
      // FIX: robust "paid"
      .in('payment_status', ['paid', 'PAID', 'Paid'])
      // FIX: show pending + confirmed + emitted (if exists), because we detect "missing voucher"
      .in('booking_status', ['pending_emission', 'confirmed', 'emitted'])
      .order('created_at', { ascending: true });

    setBookings((data as unknown as PendingBooking[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  function closeModal() {
    setOpen(false);
    setSelected(null);
    setPnr('');
    setVoucherFile(null);
    setTicketNumbers({});
    setErrorMsg('');
  }

  function openModalFor(booking: PendingBooking) {
    setSelected(booking);
    setOpen(true);

    setPnr(booking.airline_pnr || '');

    const tickets: Record<string, string> = {};
    (booking.passengers || []).forEach((p) => {
      tickets[p.id] = p.ticket_number || '';
    });
    setTicketNumbers(tickets);

    setVoucherFile(null);
    setErrorMsg('');
  }

  async function uploadVoucherPdf(booking: PendingBooking, file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const safeExt = ext === 'pdf' ? 'pdf' : ext;

    const path = `booking_${booking.booking_code}/${booking.id}/${Date.now()}.${safeExt}`;

    const { error: upErr } = await supabase.storage.from(VOUCHERS_BUCKET).upload(path, file, {
      contentType: file.type || 'application/pdf',
      upsert: true,
    });

    if (upErr) {
      throw new Error(
        `No se pudo subir el PDF. Verificá el bucket "${VOUCHERS_BUCKET}" y las policies. Detalle: ${upErr.message}`,
      );
    }

    const { data } = supabase.storage.from(VOUCHERS_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('No se pudo obtener la URL pública del voucher.');
    }

    return data.publicUrl;
  }

  async function markAsEmitted(booking: PendingBooking, voucherUrl: string) {
    const base = {
      airline_pnr: pnr.trim().toUpperCase(),
      voucher_pdf_url: voucherUrl,
      emitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // INTENTO 1: booking_status = 'emitted' (si existe en tu DB)
    const attempt = await supabase
      .from('bookings')
      .update({ ...base, booking_status: 'emitted' })
      .eq('id', booking.id);

    if (!attempt.error) return;

    // FALLBACK: booking_status = 'confirmed' (compat con el resto del proyecto)
    const fallback = await supabase
      .from('bookings')
      .update({ ...base, booking_status: 'confirmed' })
      .eq('id', booking.id);

    if (fallback.error) throw fallback.error;
  }

  async function handleSave() {
    if (!selected) return;

    if (!pnr.trim()) {
      setErrorMsg('El PNR es obligatorio.');
      return;
    }

    if (!voucherFile) {
      setErrorMsg('Debes subir el PDF del boleto oficial (voucher).');
      return;
    }

    if (voucherFile.type && voucherFile.type !== 'application/pdf') {
      setErrorMsg('El archivo debe ser PDF.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      // 1) upload PDF
      const voucherUrl = await uploadVoucherPdf(selected, voucherFile);

      // 2) update booking status + pnr + voucher + emitted_at
      await markAsEmitted(selected, voucherUrl);

      // 3) optional: save ticket numbers per passenger (si se completaron)
      for (const [passId, ticketNum] of Object.entries(ticketNumbers)) {
        if (ticketNum.trim()) {
          const { error: passErr } = await supabase
            .from('booking_passengers')
            .update({ ticket_number: ticketNum.trim() })
            .eq('id', passId);

          if (passErr) throw passErr;
        }
      }

      setSuccessMsg(`✅ Voucher cargado y reserva marcada como EMITTED — ${selected.booking_code} (PNR ${pnr.trim().toUpperCase()})`);
      closeModal();
      fetchBookings();
    } catch (err: unknown) {
      setErrorMsg(`Error: ${err instanceof Error ? err.message : 'Intenta de nuevo'}`);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Derived lists ---------- */
  const pending = bookings
    .filter((b) => isPaid(b.payment_status))
    // FIX: pendientes son las que NO tienen voucher aún, aunque estén "confirmed"
    .filter((b) => !b.voucher_pdf_url || b.booking_status === 'pending_emission')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const emitted = bookings
    .filter((b) => isPaid(b.payment_status))
    .filter((b) => Boolean(b.voucher_pdf_url))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  /* ---------- Stats ---------- */
  const warningH = settings.emission_warning_hours;
  const slaH = settings.emission_sla_hours;

  const urgentCount = pending.filter((b) => hoursElapsed(b.created_at) >= warningH).length;
  const criticalCount = pending.filter((b) => hoursElapsed(b.created_at) >= slaH - 4).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header
          title="Emisión de Boletos"
          subtitle={`Reservas pagadas sin voucher/ticket — SLA: ${settings.emission_sla_hours} horas`}
        />

        <div className="p-6 lg:p-8">
          {/* Success */}
          {successMsg && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* Summary */}
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
                  <p className="text-2xl font-bold">{pending.length}</p>
                </div>
              </div>
            </Card>

            <Card variant="bordered">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-xs text-neutral-500">Con Voucher</p>
                  <p className="text-2xl font-bold text-emerald-600">{emitted.length}</p>
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

          {/* Pending list */}
          {loading ? (
            <div className="py-12 text-center text-neutral-500">Cargando reservas pendientes...</div>
          ) : pending.length === 0 ? (
            <Card variant="bordered" className="py-16 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
              <p className="text-xl font-bold text-neutral-700">¡Todo al día!</p>
              <p className="mt-1 text-sm text-neutral-500">No hay reservas pagadas pendientes de voucher.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((booking) => {
                const hours = hoursElapsed(booking.created_at);
                const needsVoucher = !booking.voucher_pdf_url;

                return (
                  <Card
                    key={booking.id}
                    variant="bordered"
                    className={`transition-all ${
                      hours >= slaH - 4
                        ? 'border-red-300 bg-red-50/30'
                        : hours >= warningH
                          ? 'border-amber-300 bg-amber-50/30'
                          : ''
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-20 flex-col items-center justify-center rounded-xl text-xs font-bold ${slaColor(
                            hours,
                            warningH,
                            slaH,
                          )}`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>{slaLabel(hours, slaH)}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-brand-600">{booking.booking_code}</span>
                            <Badge variant="warning">{needsVoucher ? 'Pendiente Voucher' : 'Pendiente'}</Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-neutral-600">
                            {booking.profile?.full_name} · {booking.flight?.airline?.iata_code} {booking.flight?.flight_number} ·{' '}
                            {booking.flight?.origin_airport?.iata_code} → {booking.flight?.destination_airport?.iata_code}
                          </p>
                          {booking.airline_pnr && (
                            <p className="mt-1 text-xs text-neutral-500">
                              PNR actual: <strong className="font-mono">{booking.airline_pnr}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <div className="text-right">
                          <p className="text-sm font-bold">${booking.total_amount.toFixed(2)}</p>
                          <p className="text-xs text-neutral-400">
                            {booking.passengers.length} pasajero{booking.passengers.length > 1 ? 's' : ''}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => openModalFor(booking)}
                        >
                          <Upload className="h-4 w-4" /> Cargar Voucher (PDF) y Emitir
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Recently emitted (voucher uploaded) */}
          {emitted.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">Con Voucher (Recientes)</h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Vuelo</th>
                      <th className="px-4 py-3">PNR</th>
                      <th className="px-4 py-3">Voucher</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {emitted.slice(0, 20).map((b) => (
                      <tr key={b.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-mono font-bold text-brand-600">{b.booking_code}</td>
                        <td className="px-4 py-3">{b.profile?.full_name}</td>
                        <td className="px-4 py-3">
                          {b.flight?.origin_airport?.iata_code} → {b.flight?.destination_airport?.iata_code}
                        </td>
                        <td className="px-4 py-3 font-mono">{b.airline_pnr || '—'}</td>
                        <td className="px-4 py-3">
                          {b.voucher_pdf_url ? (
                            <a
                              href={b.voucher_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200"
                            >
                              <Download className="h-3.5 w-3.5" />
                              PDF
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
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

          {/* MODAL */}
          <Modal
            open={open}
            onClose={closeModal}
            className="max-w-2xl"
            title="Cargar Voucher y Emitir"
          >
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-neutral-900">Cargar Voucher (PDF) y marcar como EMITTED</h3>
                <p className="text-sm text-neutral-500">
                  Completa PNR + sube el boleto oficial en PDF. (Opcional: número de ticket por pasajero)
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMsg}</div>
              )}

              {/* Booking summary */}
              {selected && (
                <div className="rounded-xl bg-neutral-50 p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm">
                      <span className="font-semibold">Reserva:</span>{' '}
                      <span className="font-mono font-bold text-brand-600">{selected.booking_code}</span>
                    </p>
                    <p className="text-sm text-neutral-700">
                      {selected.profile?.full_name} · {selected.flight?.airline?.name} {selected.flight?.flight_number} ·{' '}
                      {selected.flight?.origin_airport?.iata_code} → {selected.flight?.destination_airport?.iata_code}
                    </p>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                        <Mail className="h-3.5 w-3.5" /> {selected.profile?.email}
                      </p>
                      {selected.profile?.phone ? (
                        <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                          <Phone className="h-3.5 w-3.5" /> {selected.profile.phone}
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-400">Sin teléfono</p>
                      )}
                      <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                        <CreditCard className="h-3.5 w-3.5" /> {selected.payment_method || '—'}
                      </p>
                      <p className="text-sm font-semibold text-emerald-700">Total: ${selected.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              <Input
                label="PNR de la Aerolínea"
                placeholder="Ej: ABC123"
                value={pnr}
                onChange={(e) => setPnr(e.target.value.toUpperCase())}
              />

              {/* PDF upload */}
              <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-4">
                <p className="text-sm font-semibold text-neutral-800">PDF del boleto oficial</p>
                <p className="text-xs text-neutral-500">Debe ser PDF. Se guarda en Storage y queda visible para el usuario.</p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setVoucherFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm"
                  />
                  {voucherFile && (
                    <span className="text-xs font-medium text-neutral-600">
                      Seleccionado: {voucherFile.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Ticket numbers (optional) */}
              {selected && (
                <div className="rounded-xl bg-neutral-50 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                    <Users className="h-4 w-4" /> Nº de Ticket por Pasajero (opcional)
                  </p>
                  <div className="space-y-3">
                    {selected.passengers.map((p, idx) => (
                      <div key={p.id}>
                        <label className="mb-1 block text-xs text-neutral-500">
                          Pasajero {idx + 1}: {p.first_name} {p.last_name}
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
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={closeModal}
                  className="sm:min-w-[140px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  isLoading={saving}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-[220px]"
                >
                  <CheckCircle className="h-4 w-4" /> Guardar y marcar EMITTED
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
}
