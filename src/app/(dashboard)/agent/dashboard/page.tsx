'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import AgentNewsWall from '@/components/agent/AgentNewsWall';
import { agentService } from '@/services/agent.service';
import {
  Clock, Users, MessageSquare, TrendingUp, Search,
  CheckCircle, ArrowRight, DollarSign, Wallet,
} from 'lucide-react';
import Link from 'next/link';

export default function AgentDashboardPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalAssigned: 0,
    pendingEmission: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    monthRevenue: 0,
    monthBookings: 0,
    clientsServed: 0,
    openTickets: 0,
    commissionPending: 0,
    commissionTotal: 0,
  });

  // Quick quoter
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await agentService.getDashboardStats(user.id);
      setStats(data);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleQuickSearch() {
    if (!origin || !destination || !date) return;
    const params = new URLSearchParams({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      date,
      type: 'oneway',
      passengers: '1',
    });
    router.push(`/flights/search?${params.toString()}`);
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />

      <div className="flex-1">
        <Header
          title="Dashboard de Agente"
          subtitle={`Bienvenido, ${user?.user_metadata?.full_name || 'Agente'}`}
        />

        <div className="p-6 md:p-8 space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3 shadow-sm border border-gray-100">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Clientes</p>
                <p className="font-bold text-lg">{loading ? '-' : stats.clientsServed}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 shadow-sm border border-gray-100">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Confirmadas</p>
                <p className="font-bold text-lg">{loading ? '-' : stats.confirmed}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 shadow-sm border border-gray-100">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Clock size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Pendientes</p>
                <p className="font-bold text-lg">{loading ? '-' : stats.pendingEmission}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 shadow-sm border border-gray-100">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><MessageSquare size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Tickets</p>
                <p className="font-bold text-lg">{loading ? '-' : stats.openTickets}</p>
              </div>
            </Card>
          </div>

          {/* News + Finance + Commissions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <AgentNewsWall />
            </div>

            <div className="space-y-6">
              {/* Monthly Revenue */}
              <Card variant="bordered" className="border-emerald-200 bg-emerald-50/30 p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-full flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-800 font-medium">Ventas del mes</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      {formatCurrency(stats.monthRevenue)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1 font-medium">
                      {stats.monthBookings} reservas cerradas este mes
                    </p>
                  </div>
                </div>
              </Card>

              {/* Commission Card */}
              <Card variant="bordered" className="border-amber-200 bg-amber-50/30 p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-full flex-shrink-0">
                    <Wallet className="h-7 w-7 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-amber-800 font-medium">Mis Comisiones</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {formatCurrency(stats.commissionTotal)}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {formatCurrency(stats.commissionPending)} pendiente de aprobación
                    </p>
                  </div>
                </div>
                <Link
                  href="/agent/dashboard/commissions"
                  className="mt-4 flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 transition"
                >
                  Ver detalle de comisiones <ArrowRight size={14} />
                </Link>
              </Card>

              {/* Quick Links */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 text-sm mb-3">Gestión Rápida</h3>
                <div className="space-y-1">
                  <Link href="/agent/dashboard/bookings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-coral hover:bg-gray-50 px-2 py-2 rounded transition">
                    <ArrowRight size={14} /> Ver todas mis reservas
                  </Link>
                  <Link href="/agent/dashboard/commissions" className="flex items-center gap-2 text-sm text-gray-600 hover:text-coral hover:bg-gray-50 px-2 py-2 rounded transition">
                    <DollarSign size={14} /> Mis comisiones
                  </Link>
                  <Link href="/agent/dashboard/tickets" className="flex items-center gap-2 text-sm text-gray-600 hover:text-coral hover:bg-gray-50 px-2 py-2 rounded transition">
                    <ArrowRight size={14} /> Reportar problema (Ticket)
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Quoter */}
          <Card className="p-6 bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" />
                Cotizador Rápido
              </h2>
              <span className="text-xs font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200">
                MODO AGENTE: NETO
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Origen (ej. HAV)"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                maxLength={3}
                className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
              />
              <input
                type="text"
                placeholder="Destino (ej. MIA)"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                maxLength={3}
                className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none uppercase"
              />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <Button
                variant="primary"
                className="h-full"
                onClick={handleQuickSearch}
                disabled={!origin || !destination || !date}
              >
                Buscar Disponibilidad
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
