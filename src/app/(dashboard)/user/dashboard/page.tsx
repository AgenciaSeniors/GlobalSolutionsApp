/**
 * @fileoverview Client Dashboard — Real-time KPIs, recent bookings, loyalty points.
 * Per spec §2.1: Client sees their bookings, loyalty points, and quick actions.
 * @module app/(dashboard)/user/dashboard/page
 */
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
  CalendarCheck, Plane, Star, Clock, CheckCircle,
  ArrowRight, Gift, Search, FileText,
  DollarSign, Sparkles, PenSquare,
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
    totalBookings: 0, activeBookings: 0, completedFlights: 0,
    loyaltyPoints: 0, totalSpent: 0, reviewsWritten: 0, pendingReviews: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [bookingsRes, profileRes, reviewsRes, recentRes, completedNoReviewRes] = await Promise.all([
        supabase.from('bookings').select('id, booking_status, payment_status, total_amount').eq('user_id', user.id),
        supabase.from('profiles').select('loyalty_points').eq('id', user.id).single(),
        supabase.from('reviews').select('id').eq('user_id', user.id),
        supabase.from('bookings').select(`
          id, booking_code, booking_status, payment_status, total_amount, airline_pnr, created_at,
          flight:flights!flight_id(
            flight_number, departure_datetime,
            airline:airlines!airline_id(name),
            origin_airport:airports!origin_airport_id(iata_code, city),
            destination_airport:airports!destination_airport_id(iata_code, city)
          )
        `).eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('id').eq('user_id', user.id).eq('booking_status', 'completed').eq('review_requested', false),
      ]);

      const allBookings = bookingsRes.data || [];
      const paidBookings = allBookings.filter(b => b.payment_status === 'paid');

      setStats({
        totalBookings: allBookings.length,
        activeBookings: allBookings.filter(b => b.booking_status === 'pending_emission' || b.booking_status === 'confirmed').length,
        completedFlights: allBookings.filter(b => b.booking_status === 'completed').length,
        loyaltyPoints: profileRes.data?.loyalty_points || 0,
        totalSpent: paidBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0),
        reviewsWritten: reviewsRes.data?.length || 0,
        pendingReviews: completedNoReviewRes.data?.length || 0,
      });

      setRecentBookings(recentRes.data as unknown as RecentBooking[] || []);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusConfig: Record<string, { label: string; variant: 'warning' | 'success' | 'info' | 'destructive' }> = {
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

  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Mi Dashboard" subtitle={`${greeting()}${user ? `, ${user.user_metadata?.full_name || 'Viajero'}` : ''}`} />
        <div className="p-8 space-y-8">

          {stats.pendingReviews > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3">
              <Star className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Tienes <strong>{stats.pendingReviews} viaje{stats.pendingReviews > 1 ? 's' : ''}</strong> sin reseña. ¡Tu opinión nos ayuda a mejorar!
              </p>
              <Link href="/user/dashboard/reviews" className="ml-auto text-sm font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1">
                Escribir reseña <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Reservas Activas', value: stats.activeBookings, icon: CalendarCheck, color: 'text-brand-600 bg-brand-50' },
              { label: 'Vuelos Completados', value: stats.completedFlights, icon: Plane, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Puntos de Lealtad', value: stats.loyaltyPoints.toLocaleString(), icon: Star, color: 'text-amber-600 bg-amber-50' },
              { label: 'Reseñas Escritas', value: stats.reviewsWritten, icon: PenSquare, color: 'text-violet-600 bg-violet-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} variant="bordered">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="text-xl font-bold text-neutral-900">{loading ? '—' : value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Spending + Loyalty */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card variant="bordered" className="border-emerald-200 bg-emerald-50/30">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                  <DollarSign className="h-7 w-7 text-emerald-600" />
                </span>
                <div>
                  <p className="text-sm text-neutral-600">Total invertido en viajes</p>
                  <p className="text-3xl font-bold text-emerald-700">
                    {loading ? '—' : `$${stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-xs text-neutral-500">{stats.totalBookings} reserva{stats.totalBookings !== 1 ? 's' : ''} en total</p>
                </div>
              </div>
            </Card>
            <Card variant="bordered" className="border-amber-200 bg-amber-50/30">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                  <Sparkles className="h-7 w-7 text-amber-600" />
                </span>
                <div>
                  <p className="text-sm text-neutral-600">Programa de Lealtad</p>
                  <p className="text-3xl font-bold text-amber-700">{loading ? '—' : stats.loyaltyPoints.toLocaleString()} pts</p>
                  <p className="text-xs text-neutral-500">Gana puntos por cada reserva y reseña</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Bookings + Quick Actions */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900">Reservas Recientes</h2>
                <Link href="/user/dashboard/bookings" className="text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver todas <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {loading ? (
                <Card variant="bordered"><p className="text-neutral-400 text-sm py-4">Cargando...</p></Card>
              ) : recentBookings.length === 0 ? (
                <Card variant="bordered" className="text-center py-10">
                  <Plane className="mx-auto h-10 w-10 text-neutral-200 mb-2" />
                  <p className="font-semibold text-neutral-700">Aún no tienes reservas</p>
                  <p className="text-sm text-neutral-500 mt-1">Busca tu próximo destino y vive la experiencia Global Solutions.</p>
                  <Link href="/flights" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
                    <Search className="h-4 w-4" /> Buscar Vuelos
                  </Link>
                </Card>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map(b => {
                    const cfg = statusConfig[b.booking_status] || statusConfig.pending_emission;
                    return (
                      <Link key={b.id} href="/user/dashboard/bookings">
                        <Card variant="bordered" className="hover:border-brand-300 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                                <Plane className="h-5 w-5 text-brand-600" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm text-neutral-900">{b.booking_code}</p>
                                  <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                                </div>
                                <p className="text-xs text-neutral-500 truncate">
                                  {b.flight ? `${b.flight.origin_airport?.city} (${b.flight.origin_airport?.iata_code}) → ${b.flight.destination_airport?.city} (${b.flight.destination_airport?.iata_code})` : 'Sin vuelo'}
                                  {b.flight?.airline?.name && ` · ${b.flight.airline.name}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-neutral-900">${Number(b.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                              <p className="text-[10px] text-neutral-400">{new Date(b.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</p>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-4 text-lg font-bold text-neutral-900">Acciones Rápidas</h2>
              <div className="space-y-2">
                {[
                  { href: '/flights', label: 'Buscar Vuelos', desc: 'Encuentra tu próximo destino', icon: Search, color: 'text-brand-600' },
                  { href: '/user/dashboard/bookings', label: 'Mis Reservas', desc: 'Ver estado y vouchers', icon: CalendarCheck, color: 'text-emerald-600' },
                  { href: '/user/dashboard/reviews', label: 'Mis Reseñas', desc: 'Comparte tu experiencia', icon: Star, color: 'text-amber-600' },
                  { href: '/offers', label: 'Ofertas Exclusivas', desc: 'Precios especiales', icon: Gift, color: 'text-rose-600' },
                  { href: '/user/dashboard/settings', label: 'Mi Perfil', desc: 'Configuración de cuenta', icon: FileText, color: 'text-neutral-600' },
                ].map(({ href, label, desc, icon: Icon, color }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/50 transition-colors">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800">{label}</p>
                      <p className="text-xs text-neutral-500">{desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">¿Cómo funciona tu reserva?</h3>
                <div className="space-y-3">
                  {[
                    { icon: DollarSign, label: 'Pagas tu reserva', color: 'text-brand-500 bg-brand-50' },
                    { icon: Clock, label: 'Emitimos tu boleto (<24h)', color: 'text-amber-500 bg-amber-50' },
                    { icon: CheckCircle, label: 'Recibes PNR + voucher', color: 'text-emerald-500 bg-emerald-50' },
                    { icon: Plane, label: '¡Buen viaje!', color: 'text-violet-500 bg-violet-50' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${color}`}><Icon className="h-4 w-4" /></span>
                      <span className="text-xs text-neutral-600">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
