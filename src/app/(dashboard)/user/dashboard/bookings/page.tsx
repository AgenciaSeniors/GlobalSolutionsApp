//src/app/(dashboard)/user/dashboard/bookings/page.tsx
/**
 * @fileoverview User Bookings — My reservations with status tracking.
 * Per spec §6.2: Shows status flow, voucher download when available.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { toast } from 'sonner';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Plane, FileText, Clock, CheckCircle, XCircle, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';
import type { BookingWithDetails } from '@/types/models';

interface UserBooking {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  airline_pnr: string | null;
  voucher_pdf_url: string | null;
  created_at: string;
    flight?: {
    flight_number: string;
    departure_datetime: string;
    airline: { name: string } | null;
    origin_airport: { iata_code: string; city: string } | null;
    destination_airport: { iata_code: string; city: string } | null;
  } | null;

  passengers: { first_name: string; last_name: string; ticket_number: string | null }[];
}

type StatusConfig = {
  icon: typeof Clock;
  label: string;
  color: string;
  variant: 'warning' | 'success' | 'destructive' | 'info' | 'default';
};

export default function UserBookingsPage() {
  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<UserBooking | null>(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        // ✅ CORRECCIÓN: Usamos fetch para llamar a la API en lugar del service de backend
        const res = await fetch('/api/bookings');
        
        if (!res.ok) {
          throw new Error('Error al cargar las reservas');
        }

        const { data } = await res.json();

        // ✅ Normalizamos para que la UI nunca crashee por passengers undefined
        const normalized: UserBooking[] = (data ?? []).map((b: BookingWithDetails ) => ({
          ...b,
          passengers: Array.isArray(b.passengers) ? b.passengers : [],
          voucher_pdf_url: b.voucher_pdf_url ?? null,
        }));

        setBookings(normalized);
      } catch (error) {
        console.error(error);
        // No rompemos la UI
        setBookings([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user]);

  const statusConfig: Record<string, StatusConfig> = {
  pending_emission: {
    icon: Clock,
    label: 'Pendiente Emisión',
    color: 'text-amber-500',
    variant: 'warning',
  },
  confirmed: {
    icon: CheckCircle,
    label: 'Confirmada',
    color: 'text-brand-500',
    variant: 'info',
  },
  emitted: {
    icon: CheckCircle,
    label: 'Emitida',
    color: 'text-emerald-500',
    variant: 'success',
  },
  cancellation_requested: {
    icon: AlertTriangle,
    label: 'Cancelación Solicitada',
    color: 'text-amber-600',
    variant: 'warning',
  },
  completed: {
    icon: CheckCircle,
    label: 'Completada',
    color: 'text-neutral-600',
    variant: 'default',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelada',
    color: 'text-red-500',
    variant: 'destructive',
  },
};

  

const openCancelModal = (b: UserBooking) => {
  setSelectedBooking(b);
  setCancelModalOpen(true);
};

const requestCancellation = async () => {
  if (!selectedBooking) return;

  setSubmittingCancel(true);
  try {
    const res = await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: selectedBooking.id,
        action: 'REQUEST_CANCELLATION',
      }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || 'No se pudo solicitar la cancelación');
    }

    toast.success('Solicitud de cancelación enviada. Te contactaremos por WhatsApp.');

    setBookings((prev) =>
      prev.map((b) =>
        b.id === selectedBooking.id ? { ...b, booking_status: 'cancellation_requested' } : b,
      ),
    );

    setCancelModalOpen(false);
    setSelectedBooking(null);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Error inesperado');
  } finally {
    setSubmittingCancel(false);
  }
};

return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Mis Reservas" subtitle="Historial de viajes y vouchers" />
        <div className="p-8">
          {loading ? (
            <p className="text-neutral-500">Cargando...</p>
          ) : bookings.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <Plane className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
              <p className="font-semibold">Aún no tienes reservas</p>
              <p className="text-sm text-neutral-500">Busca tu próximo vuelo y reserva aquí.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const cfg = statusConfig[b.booking_status] || statusConfig.pending_emission;
                const StatusIcon = cfg.icon;

                // ✅ Fix robusto: no dependemos de 'PAID' vs enum
                const payment = String(b.payment_status ?? '').toLowerCase();
                const isPaid = payment === 'paid';

                return (
                  <Card key={b.id} variant="bordered">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <StatusIcon className={`h-8 w-8 flex-shrink-0 ${cfg.color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-600">{b.booking_code}</span>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </div>

                          <p className="mt-1 text-sm">
                            {b.flight?.airline?.name} {b.flight?.flight_number} · {b.flight?.origin_airport?.city} (
                            {b.flight?.origin_airport?.iata_code}) → {b.flight?.destination_airport?.city} (
                            {b.flight?.destination_airport?.iata_code})
                          </p>

                          <p className="text-xs text-neutral-400">
                            Reservado: {new Date(b.created_at).toLocaleDateString('es')} · Total: $
                            {b.total_amount.toFixed(2)}
                          </p>

                          {b.airline_pnr && (
                            <p className="mt-1 text-xs text-neutral-500">
                              PNR Aerolínea: <strong className="font-mono">{b.airline_pnr}</strong>
                            </p>
                          )}

                          {(b.passengers?.length ?? 0) > 0 && (
                            <div className="mt-2 text-xs text-neutral-500">
                              Pasajeros: {(b.passengers ?? []).map((p) => `${p.first_name} ${p.last_name}`).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                        {/* BOTÓN PAGAR (solo si NO está pagado) */}
                        {!isPaid && (
                          <a
                            href={`/pay?booking_id=${b.id}`}
                            className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pagar
                          </a>
                        )}


{/* SOLICITAR CANCELACIÓN (si está confirmada o emitida) */}
{(() => {
  const s = String(b.booking_status ?? '').toLowerCase();
  const canRequestCancellation = ['confirmed', 'emitted'].includes(s);
  const alreadyRequested = s === 'cancellation_requested';
  const isCancelled = s === 'cancelled';

  if (!canRequestCancellation || alreadyRequested || isCancelled) return null;

  return (
    <button
      onClick={() => openCancelModal(b)}
      className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
    >
      <AlertTriangle className="h-4 w-4" />
      Solicitar Cancelación
    </button>
  );
})()}

                        {/* BOTÓN VOUCHER (solo si existe) */}
                        {b.voucher_pdf_url && (
                          <a
                            href={b.voucher_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100"
                          >
                            <FileText className="h-4 w-4" />
                            Descargar Voucher
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

<Modal
  open={cancelModalOpen}
  onClose={() => {
    if (submittingCancel) return;
    setCancelModalOpen(false);
    setSelectedBooking(null);
  }}
  title="Solicitar Cancelación"
>
  <div className="space-y-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-xl bg-amber-50 p-2 text-amber-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-neutral-900">Solicitar Cancelación</h3>
        <p className="text-sm text-neutral-600">
          Las cancelaciones están sujetas a penalizaciones de la aerolínea. Nuestro equipo le
          contactará por WhatsApp.
        </p>
      </div>
    </div>

    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        onClick={() => {
          if (submittingCancel) return;
          setCancelModalOpen(false);
          setSelectedBooking(null);
        }}
        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Volver
      </button>

      <button
        onClick={requestCancellation}
        disabled={submittingCancel}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submittingCancel ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Confirmar solicitud
      </button>
    </div>
  </div>
</Modal>

      </div>
    </div>
  );
}
