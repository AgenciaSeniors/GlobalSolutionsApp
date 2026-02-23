/**
 * @fileoverview Admin Dashboard — Real-time system overview.
 * Per spec §2.3: "Dios del sistema". Shows live KPIs from Supabase,
 * quick-action cards linking to Emission, Flights, Markup, etc.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  CalendarCheck,
  DollarSign,
  Plane,
  ShieldCheck,
  Star,
  AlertTriangle,
  ArrowRight,
  Clock,
  TrendingUp,
  FileText,
  Megaphone,
} from 'lucide-react';

interface DashboardStats {
  totalBookings: number;
  pendingEmission: number;
  urgentEmissions: number;
  activeAgents: number;
  monthRevenue: number;
  activeFlights: number;
  pendingReviews: number;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  profile: { full_name: string } | null;
  flight: {
    origin_airport: { iata_code: string } | null;
    destination_airport: { iata_code: string } | null;
  } | null;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const { settings } = useAppSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDashboard() {
    const [
      bookingsRes,
      pendingRes,
      usersRes,
      agentsRes,
      paidRes,
      flightsRes,
      reviewsRes,
      recentRes,
    ] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('bookings').select('id, created_at', { count: 'exact' }).eq('booking_status', 'pending_emission').eq('payment_status', 'paid'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'agent').eq('is_active', true),
      supabase.from('bookings').select('total_amount').eq('payment_status', 'paid'),
      supabase.from('flights').select('id', { count: 'exact', head: true }),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      supabase.from('bookings').select(`
        id, booking_code, booking_status, payment_status, total_amount, created_at,
        profile:profiles!user_id(full_name),
        flight:flights(
          origin_airport:airports!origin_airport_id(iata_code),
          destination_airport:airports!destination_airport_id(iata_code)
        )
      `).order('created_at', { ascending: false }).limit(5),
    ]);

    // Count urgent (>12h pending)
    const pendingData = pendingRes.data || [];
    const now = Date.now();
    const urgentCount = pendingData.filter(b => (now - new Date(b.created_at).getTime()) > settings.emission_warning_hours * 3600000).length;

    // Revenue this month
    const monthRevenue = (paidRes.data || []).reduce((sum, b) => sum + (b.total_amount || 0), 0);

    setStats({
      totalBookings: bookingsRes.count || 0,
      pendingEmission: pendingRes.count || 0,
      urgentEmissions: urgentCount,
      activeAgents: agentsRes.count || 0,
      monthRevenue,
      activeFlights: flightsRes.count || 0,
      pendingReviews: reviewsRes.count || 0,
    });

    setRecentBookings((recentRes.data as unknown as RecentBooking[]) || []);
    setLoading(false);
  }

  // FIX: Changed 'error' to 'destructive' to match Badge props
  const statusVariant: Record<string, 'warning' | 'success' | 'destructive' | 'info'> = {
    pending_emission: 'warning',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'destructive', // Changed from 'error'
  };

  const statusLabel: Record<string, string> = {
    pending_emission: 'Pendiente',
    confirmed: 'Emitida',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };

  if (loading || !stats) {
    return (
      <div className="flex min-h-screen">
        <Sidebar links={ADMIN_SIDEBAR_LINKS} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-neutral-500">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header
          title="Panel de Administración"
          subtitle="Vista general del sistema en tiempo real"
        />
        <div className="p-6 lg:p-8">
          {/* Urgent Alert */}
          {stats.urgentEmissions > 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-4">
              <AlertTriangle className="h-6 w-6 flex-shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="font-bold text-red-800">
                  ¡{stats.urgentEmissions} reserva{stats.urgentEmissions > 1 ? 's' : ''} con más de 12 horas sin emitir!
                </p>
                <p className="text-sm text-red-600">
                  El compromiso es entrega en máximo 24 horas. Acción inmediata requerida.
                </p>
              </div>
              <Link
                href="/admin/dashboard/emission"
                className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ir a Emisión <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* KPI Grid */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'Pendientes Emisión',
                value: stats.pendingEmission,
                icon: Clock,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                href: '/admin/dashboard/emission',
                urgent: stats.pendingEmission > 0,
              },
              {
                label: 'Total Reservas',
                value: stats.totalBookings,
                icon: CalendarCheck,
                color: 'text-brand-600',
                bg: 'bg-brand-50',
                href: '/admin/dashboard/bookings',
              },
              {
                label: 'Ingresos',
                value: `$${stats.monthRevenue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                icon: DollarSign,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                href: '/admin/dashboard/bookings',
              },
              {
                label: 'Vuelos Activos',
                value: stats.activeFlights,
                icon: Plane,
                color: 'text-cyan-600',
                bg: 'bg-cyan-50',
                href: '/admin/dashboard/markup',
              },
              {
                label: 'Gestores Activos',
                value: stats.activeAgents,
                icon: ShieldCheck,
                color: 'text-violet-600',
                bg: 'bg-violet-50',
                href: '/admin/dashboard/agents',
              },
              {
                label: 'Reseñas Pendientes',
                value: stats.pendingReviews,
                icon: Star,
                color: 'text-amber-500',
                bg: 'bg-amber-50',
                href: '/admin/dashboard/reviews',
              },
      
            ].map(({ label, value, icon: Icon, color, bg, href, urgent }) => (
              <Link key={label} href={href}>
                <Card
                  variant="bordered"
                  className={`transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    urgent ? 'border-amber-300 bg-amber-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg} ${color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-neutral-500">{label}</p>
                      <p className="text-xl font-bold text-neutral-900">{value}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Actions + Recent Activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                Acciones Rápidas
              </h3>
              {[
                { label: 'Emitir Boletos', desc: `${stats.pendingEmission} pendientes`, icon: FileText, href: '/admin/dashboard/emission', color: 'text-brand-600 bg-brand-50' },
                { label: 'Gestionar Vuelos & Markup', desc: 'Precios y disponibilidad', icon: TrendingUp, href: '/admin/dashboard/flights', color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Moderar Reseñas', desc: `${stats.pendingReviews} por aprobar`, icon: Star, href: '/admin/dashboard/reviews', color: 'text-amber-600 bg-amber-50' },
                { label: 'Publicar Noticia', desc: 'Muro de gestores', icon: Megaphone, href: '/admin/dashboard/news', color: 'text-blue-600 bg-blue-50' },
              ].map(({ label, desc, icon: Icon, href, color }) => (
                <Link key={href} href={href}>
                  <Card variant="bordered" className="flex items-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-800">{label}</p>
                      <p className="text-xs text-neutral-500">{desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-neutral-300" />
                  </Card>
                </Link>
              ))}
            </div>

            {/* Recent Bookings */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Reservas Recientes
                </h3>
                <Link
                  href="/admin/dashboard/bookings"
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  Ver todas →
                </Link>
              </div>
              <Card variant="bordered">
                {recentBookings.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    No hay reservas aún
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {recentBookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-brand-600">
                                {b.booking_code}
                              </span>
                              <Badge variant={statusVariant[b.booking_status] || 'warning'}>
                                {statusLabel[b.booking_status] || b.booking_status}
                              </Badge>
                            </div>
                            <p className="text-xs text-neutral-500">
                              {b.profile?.full_name || 'Sin nombre'} ·{' '}
                              {b.flight?.origin_airport?.iata_code || '?'} →{' '}
                              {b.flight?.destination_airport?.iata_code || '?'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${b.total_amount?.toFixed(2)}</p>
                          <p className="text-xs text-neutral-400">
                            {new Date(b.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}