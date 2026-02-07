/**
 * @fileoverview Agent Dashboard — Real-time KPIs + activity feed.
 * Per spec §2.2: Agent sees assigned bookings, metrics, news feed.
 * Agents handle client bookings and communicate via platform (no WhatsApp).
 * @module app/(dashboard)/agent/dashboard/page
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  CalendarCheck, DollarSign, Plane, Clock, Users, Newspaper,
  MessageSquare, ArrowRight, AlertTriangle, CheckCircle, TrendingUp,
  FileText, Bell,
} from 'lucide-react';

interface DashboardStats {
  totalAssigned: number;
  pendingEmission: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  monthRevenue: number;
  monthBookings: number;
  clientsServed: number;
  openTickets: number;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  profile?: { full_name: string; email: string } | null;
  flight?: {
    flight_number: string;
    departure_datetime: string;
    airline: { name: string } | null;
    origin_airport: { iata_code: string; city: string } | null;
    destination_airport: { iata_code: string; city: string } | null;
  } | null;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_pinned: boolean;
  created_at: string;
}

export default function AgentDashboardPage() {
  const supabase = createClient();
  const { user } = useAuthContext();

  const [stats, setStats] = useState<DashboardStats>({
    totalAssigned: 0, pendingEmission: 0, confirmed: 0, completed: 0,
    cancelled: 0, monthRevenue: 0, monthBookings: 0, clientsServed: 0,
    openTickets: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [latestNews, setLatestNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      const [
        bookingsRes,
        monthBookingsRes,
        ticketsRes,
        newsRes,
        recentRes,
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, booking_status, payment_status, total_amount, user_id')
          .eq('assigned_agent_id', user.id),
        supabase
          .from('bookings')
          .select('id, total_amount')
          .eq('assigned_agent_id', user.id)
          .gte('created_at', monthStart),
        supabase
          .from('agent_tickets')
          .select('id')
          .eq('created_by', user.id)
          .in('status', ['open', 'in_progress', 'waiting_response']),
        supabase
          .from('agent_news')
          .select('id, title, content, category, is_pinned, created_at')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('bookings')
          .select(`
            id, booking_code, booking_status, payment_status, total_amount, created_at,
            profile:profiles!user_id(full_name, email),
            flight:flights!flight_id(
              flight_number, departure_datetime,
              airline:airlines!airline_id(name),
              origin_airport:airports!origin_airport_id(iata_code, city),
              destination_airport:airports!destination_airport_id(iata_code, city)
            )
          `)
          .eq('assigned_agent_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const allBookings = bookingsRes.data || [];
      const monthB = monthBookingsRes.data || [];
      const uniqueClients = new Set(allBookings.map(b => b.user_id).filter(Boolean));

      setStats({
        totalAssigned: allBookings.length,
        pendingEmission: allBookings.filter(b => b.booking_status === 'pending_emission').length,
        confirmed: allBookings.filter(b => b.booking_status === 'confirmed').length,
        completed: allBookings.filter(b => b.booking_status === 'completed').length,
        cancelled: allBookings.filter(b => b.booking_status === 'cancelled').length,
        monthRevenue: monthB.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0),
        monthBookings: monthB.length,
        clientsServed: uniqueClients.size,
        openTickets: ticketsRes.data?.length || 0,
      });

      setRecentBookings(recentRes.data as unknown as RecentBooking[] || []);
      setLatestNews(newsRes.data as NewsItem[] || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Dashboard de Gestor"
          subtitle={`Bienvenido${user ? `, ${user.user_metadata?.full_name || 'Gestor'}` : ''}`}
        />
        <div className="p-8 space-y-8">

          {/* ── Alert: Pending Emissions ── */}
          {stats.pendingEmission > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Tienes <strong>{stats.pendingEmission} reserva{stats.pendingEmission > 1 ? 's' : ''}</strong> pendiente{stats.pendingEmission > 1 ? 's' : ''} de emisión.
              </p>
              <Link
                href="/agent/dashboard/bookings?filter=pending_emission"
                className="ml-auto text-sm font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                Ver reservas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Total Asignadas', value: stats.totalAssigned, icon: CalendarCheck, color: 'text-brand-600 bg-brand-50' },
              { label: 'Pend. Emisión', value: stats.pendingEmission, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Confirmadas', value: stats.confirmed, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Clientes', value: stats.clientsServed, icon: Users, color: 'text-violet-600 bg-violet-50' },
              { label: 'Tickets Abiertos', value: stats.openTickets, icon: MessageSquare, color: 'text-orange-600 bg-orange-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} variant="bordered">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs text-neutral-500">{label}</p>
                    <p className="text-xl font-bold text-neutral-900">{loading ? '—' : value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Revenue + Status ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card variant="bordered" className="border-emerald-200 bg-emerald-50/30">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                  <TrendingUp className="h-7 w-7 text-emerald-600" />
                </span>
                <div>
                  <p className="text-sm text-neutral-600">Ventas este mes</p>
                  <p className="text-3xl font-bold text-emerald-700">
                    {loading ? '—' : `$${stats.monthRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {stats.monthBookings} reserva{stats.monthBookings !== 1 ? 's' : ''} en {new Date().toLocaleDateString('es', { month: 'long' })}
                  </p>
                </div>
              </div>
            </Card>

            <Card variant="bordered" className="border-violet-200 bg-violet-50/30">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
                  <DollarSign className="h-7 w-7 text-violet-600" />
                </span>
                <div>
                  <p className="text-sm text-neutral-600">Resumen por estados</p>
                  <div className="mt-1 flex items-center gap-4 text-sm flex-wrap">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="h-3.5 w-3.5" /> {stats.completed} completadas
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3.5 w-3.5" /> {stats.pendingEmission} pendientes
                    </span>
                    <span className="text-red-500">{stats.cancelled} canceladas</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Recent Bookings + News ── */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Recent Bookings */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900">Reservas Recientes</h2>
                <Link href="/agent/dashboard/bookings" className="text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Ver todas <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {loading ? (
                <Card variant="bordered"><p className="text-neutral-400 text-sm py-4">Cargando...</p></Card>
              ) : recentBookings.length === 0 ? (
                <Card variant="bordered" className="text-center py-10">
                  <Plane className="mx-auto h-10 w-10 text-neutral-200 mb-2" />
                  <p className="text-sm text-neutral-500">Aún no tienes reservas asignadas</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {recentBookings.map(b => (
                    <Link key={b.id} href={`/agent/dashboard/bookings?selected=${b.id}`}>
                      <Card variant="bordered" className="hover:border-brand-300 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50">
                              <Plane className="h-5 w-5 text-brand-600" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm text-neutral-900">{b.booking_code}</p>
                                <Badge variant={statusBadge(b.booking_status)} className="text-[10px]">
                                  {statusLabel[b.booking_status] || b.booking_status}
                                </Badge>
                              </div>
                              <p className="text-xs text-neutral-500 truncate">
                                {b.profile?.full_name || 'Sin cliente'} ·{' '}
                                {b.flight
                                  ? `${b.flight.origin_airport?.iata_code || '?'} → ${b.flight.destination_airport?.iata_code || '?'}`
                                  : 'Sin vuelo'}
                                {b.flight?.airline?.name && ` · ${b.flight.airline.name}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-neutral-900">
                              ${Number(b.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {new Date(b.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* News Feed + Quick Actions */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-brand-500" /> Noticias
                </h2>
                <Link href="/agent/dashboard/news" className="text-sm font-medium text-brand-600 hover:text-brand-800">
                  Ver todas
                </Link>
              </div>

              {loading ? (
                <Card variant="bordered"><p className="text-neutral-400 text-sm">Cargando...</p></Card>
              ) : latestNews.length === 0 ? (
                <Card variant="bordered" className="text-center py-8">
                  <Bell className="mx-auto h-8 w-8 text-neutral-200 mb-2" />
                  <p className="text-sm text-neutral-500">Sin noticias recientes</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {latestNews.map(n => (
                    <Card key={n.id} variant="bordered" className={n.is_pinned ? 'border-l-4 border-l-amber-400 bg-amber-50/30' : ''}>
                      <h4 className="font-semibold text-sm text-neutral-900 line-clamp-1">{n.title}</h4>
                      <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{n.content}</p>
                      <p className="mt-2 text-[10px] text-neutral-400">
                        {new Date(n.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </Card>
                  ))}
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">Acciones Rápidas</h3>
                {[
                  { href: '/agent/dashboard/bookings', label: 'Mis Reservas', icon: CalendarCheck, color: 'text-brand-600' },
                  { href: '/agent/dashboard/tickets', label: 'Crear Ticket', icon: MessageSquare, color: 'text-orange-600' },
                  { href: '/agent/dashboard/news', label: 'Muro de Noticias', icon: Newspaper, color: 'text-violet-600' },
                  { href: '/agent/dashboard/settings', label: 'Mi Perfil', icon: FileText, color: 'text-neutral-600' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50/50 transition-colors"
                  >
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-neutral-700">{label}</span>
                    <ArrowRight className="ml-auto h-4 w-4 text-neutral-300" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
