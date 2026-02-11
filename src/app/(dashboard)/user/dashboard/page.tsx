/**
 * @fileoverview Client Dashboard — Real-time KPIs, recent bookings, loyalty points.
 * Module 6: Dashboard & Loyalty (endpoint real for bookings).
 */
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { CalendarCheck, Plane, Star, Clock, ArrowRight, DollarSign } from 'lucide-react';

import { bookingsService, type BookingWithDetails } from '@/services/bookings.service';

interface DashboardStats {
  totalBookings: number;
  activeBookings: number;
  completedFlights: number;
  loyaltyPoints: number;
  totalSpent: number;
  reviewsWritten: number;
  pendingReviews: number;
}

type BadgeVariant = 'warning' | 'success' | 'info' | 'destructive';

function isoDateSafe(input: string): string {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function isActiveStatus(status: string): boolean {
  return status === 'pending_emission' || status === 'confirmed';
}

function isPaidStatus(status: string): boolean {
  return status === 'paid';
}

export default function UserDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuthContext();

  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    activeBookings: 0,
    completedFlights: 0,
    loyaltyPoints: 0,
    totalSpent: 0,
    reviewsWritten: 0,
    pendingReviews: 0,
  });

  const [recentBookings, setRecentBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // ✅ Módulo 6: bookings desde endpoint real (service)
      const [allBookings, profileRes, reviewsRes, completedNoReviewRes] = await Promise.all([
        bookingsService.listWithDetails(),

        // ✅ IMPORTANTE: profiles se busca por profiles.user_id (auth uid)
        supabase
          .from('profiles')
          .select('loyalty_points')
          .eq('user_id', user.id)
          .single<{ loyalty_points: number | null }>(),

        supabase.from('reviews').select('id').eq('user_id', user.id),

        supabase
          .from('bookings')
          .select('id')
          .eq('user_id', user.id)
          .eq('booking_status', 'completed')
          .eq('review_requested', false),
      ]);

      // Orden por created_at DESC para recentBookings
      const sortedBookings = [...allBookings].sort((a, b) =>
        isoDateSafe(b.created_at).localeCompare(isoDateSafe(a.created_at)),
      );

      const paidBookings = sortedBookings.filter((b) => isPaidStatus(String(b.payment_status)));
      const totalSpent = paidBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

      setStats({
        totalBookings: sortedBookings.length,
        activeBookings: sortedBookings.filter((b) => isActiveStatus(String(b.booking_status))).length,
        completedFlights: sortedBookings.filter((b) => String(b.booking_status) === 'completed').length,
        loyaltyPoints: profileRes.data?.loyalty_points ?? 0,
        totalSpent,
        reviewsWritten: reviewsRes.data?.length ?? 0,
        pendingReviews: completedNoReviewRes.data?.length ?? 0,
      });

      // “Recientes”: top 5
      setRecentBookings(sortedBookings.slice(0, 5));
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      // No rompemos UI, dejamos valores por defecto
      setStats({
        totalBookings: 0,
        activeBookings: 0,
        completedFlights: 0,
        loyaltyPoints: 0,
        totalSpent: 0,
        reviewsWritten: 0,
        pendingReviews: 0,
      });
      setRecentBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    pending_emission: { label: 'Procesando', variant: 'warning' },
    confirmed: { label: 'Emitido', variant: 'success' },
    completed: { label: 'Completado', variant: 'info' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />

      <div className="flex-1">
        <Header
          title="Mi Dashboard"
          subtitle={`${greeting()}${user ? `, ${user.user_metadata?.full_name || 'Viajero'}` : ''}`}
        />

        <div className="p-6 space-y-6">
          {loading ? (
            <Card className="p-6">
              <div className="flex items-center gap-2 text-sm opacity-80">
                <Clock size={16} />
                Cargando tus datos…
              </div>
            </Card>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">Reservas totales</div>
                    <Plane size={18} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{stats.totalBookings}</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">Activas</div>
                    <CalendarCheck size={18} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{stats.activeBookings}</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">Puntos</div>
                    <Star size={18} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{stats.loyaltyPoints}</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">Total gastado</div>
                    <DollarSign size={18} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(stats.totalSpent)}</div>
                </Card>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/user/dashboard/bookings"
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  Ver mis reservas <ArrowRight size={16} />
                </Link>

                <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  Pendientes de reseña:{' '}
                  <Badge variant={stats.pendingReviews > 0 ? 'warning' : 'success'}>
                    {stats.pendingReviews}
                  </Badge>
                </div>

                <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  Reseñas escritas: <Badge variant="info">{stats.reviewsWritten}</Badge>
                </div>
              </div>

              {/* Recientes */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Reservas recientes</div>
                  <Link href="/user/dashboard/bookings" className="text-sm underline">
                    Ver todas
                  </Link>
                </div>

                {recentBookings.length === 0 ? (
                  <div className="mt-4 text-sm opacity-80">Aún no tenés reservas recientes.</div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left opacity-70">
                        <tr>
                          <th className="py-2 pr-4">Código</th>
                          <th className="py-2 pr-4">Estado</th>
                          <th className="py-2 pr-4">Pago</th>
                          <th className="py-2 pr-4">Total</th>
                          <th className="py-2 pr-4">PNR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b) => {
                          const cfg = statusConfig[String(b.booking_status)] ?? {
                            label: String(b.booking_status),
                            variant: 'info' as const,
                          };

                          const paid = isPaidStatus(String(b.payment_status));

                          return (
                            <tr key={b.id} className="border-t">
                              <td className="py-2 pr-4">{b.booking_code}</td>
                              <td className="py-2 pr-4">
                                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                              </td>
                              <td className="py-2 pr-4">
                                <Badge variant={paid ? 'success' : 'warning'}>
                                  {String(b.payment_status)}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4">{formatMoney(Number(b.total_amount) || 0)}</td>
                              <td className="py-2 pr-4">{b.airline_pnr ?? '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
