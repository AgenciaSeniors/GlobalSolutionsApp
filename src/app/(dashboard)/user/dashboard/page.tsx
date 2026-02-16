'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  CalendarCheck, Plane, Star, Clock, ArrowRight,
  DollarSign, Sparkles, Trophy,
} from 'lucide-react';

interface DashboardStats {
  totalBookings: number;
  activeBookings: number;
  completedFlights: number;
  loyaltyPoints: number;
  totalSpent: number;
  reviewsWritten: number;
  pendingReviews: number;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  airline_pnr: string | null;
  created_at: string;
  flight?: {
    flight_number: string;
    departure_datetime: string;
    airline: { name: string } | null;
    origin_airport: { iata_code: string; city: string } | null;
    destination_airport: { iata_code: string; city: string } | null;
  } | null;
}

export default function UserDashboardPage() {
  const supabase = createClient();
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

  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [bookingsRes, profileRes, reviewsRes, recentRes, completedNoReviewRes] =
        await Promise.all([
          supabase
            .from('bookings')
            .select('id, booking_status, payment_status, total_amount')
            .eq('user_id', user.id),

          // FIX: profiles PK is 'id' (which equals auth.uid()), NOT 'user_id'
          supabase
            .from('profiles')
            .select('loyalty_points')
            .eq('id', user.id)
            .single(),

          supabase.from('reviews').select('id').eq('user_id', user.id),

          supabase
            .from('bookings')
            .select(
              `
              id, booking_code, booking_status, payment_status, total_amount, airline_pnr, created_at,
              flight:flights!flight_id(
                flight_number, departure_datetime,
                airline:airlines!airline_id(name),
                origin_airport:airports!origin_airport_id(iata_code, city),
                destination_airport:airports!destination_airport_id(iata_code, city)
              )
            `,
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),

          supabase
            .from('bookings')
            .select('id')
            .eq('user_id', user.id)
            .eq('booking_status', 'completed')
            .eq('review_requested', false),
        ]);

      const allBookings = bookingsRes.data || [];
      const paidBookings = allBookings.filter((b) => b.payment_status === 'paid');

      setStats({
        totalBookings: allBookings.length,
        activeBookings: allBookings.filter(
          (b) => b.booking_status === 'pending_emission' || b.booking_status === 'confirmed',
        ).length,
        completedFlights: allBookings.filter((b) => b.booking_status === 'completed').length,
        loyaltyPoints: profileRes.data?.loyalty_points || 0,
        totalSpent: paidBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0),
        reviewsWritten: reviewsRes.data?.length || 0,
        pendingReviews: completedNoReviewRes.data?.length || 0,
      });

      setRecentBookings((recentRes.data as unknown as RecentBooking[]) || []);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }

    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusConfig: Record<
    string,
    { label: string; variant: 'warning' | 'success' | 'info' | 'destructive' }
  > = {
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
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  // Loyalty tier
  const getLoyaltyTier = (pts: number) => {
    if (pts >= 5000) return { name: 'Platino', color: 'text-purple-700 bg-purple-100', icon: '💎' };
    if (pts >= 2000) return { name: 'Oro', color: 'text-amber-700 bg-amber-100', icon: '🥇' };
    if (pts >= 500) return { name: 'Plata', color: 'text-gray-600 bg-gray-100', icon: '🥈' };
    return { name: 'Bronce', color: 'text-orange-700 bg-orange-100', icon: '🥉' };
  };

  const tier = getLoyaltyTier(stats.loyaltyPoints);

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
                <Card className="p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">Reservas totales</div>
                    <Plane size={18} className="text-brand-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-navy">{stats.totalBookings}</div>
                </Card>

                <Card className="p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">Activas</div>
                    <CalendarCheck size={18} className="text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-navy">{stats.activeBookings}</div>
                </Card>

                <Card className="p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">Total gastado</div>
                    <DollarSign size={18} className="text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-navy">{formatMoney(stats.totalSpent)}</div>
                </Card>

                {/* Loyalty Points Card */}
                <Card className="p-4 border border-amber-200 bg-amber-50/30">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-amber-700 flex items-center gap-1">
                      <Sparkles size={14} /> Puntos de Lealtad
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tier.color}`}>
                      {tier.icon} {tier.name}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold text-amber-700">{stats.loyaltyPoints.toLocaleString()} pts</div>
                  <Link
                    href="/user/dashboard/loyalty"
                    className="mt-2 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
                  >
                    Ver historial de puntos <ArrowRight size={12} />
                  </Link>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/user/dashboard/bookings"
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
                >
                  <Plane size={16} /> Ver mis reservas <ArrowRight size={16} />
                </Link>

                <Link
                  href="/user/dashboard/reviews"
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
                >
                  <Star size={16} />
                  Pendientes de reseña
                  <Badge variant={stats.pendingReviews > 0 ? 'warning' : 'success'}>
                    {stats.pendingReviews}
                  </Badge>
                </Link>

                <Link
                  href="/user/dashboard/loyalty"
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition"
                >
                  <Trophy size={16} /> Mis puntos
                  <Badge variant="offer">{stats.loyaltyPoints}</Badge>
                </Link>
              </div>

              {/* Recent Bookings */}
              <Card className="p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-navy">Reservas recientes</div>
                  <Link href="/user/dashboard/bookings" className="text-sm text-coral hover:underline">
                    Ver todas
                  </Link>
                </div>

                {recentBookings.length === 0 ? (
                  <div className="mt-4 text-sm text-gray-500">Aún no tenés reservas recientes.</div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-500 text-xs">
                        <tr>
                          <th className="py-2 pr-4">Código</th>
                          <th className="py-2 pr-4">Ruta</th>
                          <th className="py-2 pr-4">Estado</th>
                          <th className="py-2 pr-4">Total</th>
                          <th className="py-2 pr-4">PNR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b) => {
                          const cfg = statusConfig[b.booking_status] || {
                            label: b.booking_status,
                            variant: 'info' as const,
                          };
                          return (
                            <tr key={b.id} className="border-t border-gray-100">
                              <td className="py-3 pr-4 font-mono font-bold text-brand-600">{b.booking_code}</td>
                              <td className="py-3 pr-4 text-gray-600">
                                {b.flight?.origin_airport?.iata_code || '?'} → {b.flight?.destination_airport?.iata_code || '?'}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                              </td>
                              <td className="py-3 pr-4">{formatMoney(Number(b.total_amount) || 0)}</td>
                              <td className="py-3 pr-4 font-mono">{b.airline_pnr ?? '—'}</td>
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
