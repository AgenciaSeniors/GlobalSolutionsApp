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
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Plane, FileText, Clock, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import type { BookingWithDetails } from '@/types/models'

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
  variant: 'warning' | 'success' | 'destructive' | 'info';
};

export default function UserBookingsPage() {
  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);

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
      label: 'Procesando Emisión',
      color: 'text-amber-500',
      variant: 'warning',
    },
    confirmed: {
      icon: CheckCircle,
      label: 'Emitido',
      color: 'text-emerald-500',
      variant: 'success',
    },
    completed: {
      icon: CheckCircle,
      label: 'Completado',
      color: 'text-brand-500',
      variant: 'info',
    },
    cancelled: {
      icon: XCircle,
      label: 'Cancelado',
      color: 'text-red-500',
      variant: 'destructive',
    },
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
        </div>
      </div>
    </div>
  );
}