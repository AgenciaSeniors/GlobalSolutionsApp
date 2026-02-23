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

             
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
