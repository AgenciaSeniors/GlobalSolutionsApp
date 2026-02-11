'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import AgentNewsWall from "@/components/agent/AgentNewsWall";
import { agentService } from '@/services/agent.service'; // <--- Importamos tu nuevo servicio
import {
   Clock, Users, MessageSquare, 
  TrendingUp, Search, CheckCircle, ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function AgentDashboardPage() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  
  // Estado completo con todas las métricas que definimos en el servicio
  const [stats, setStats] = useState({
    totalAssigned: 0,
    pendingEmission: 0,
    confirmed: 0,
    monthRevenue: 0,
    monthBookings: 0,
    clientsServed: 0,
    openTickets: 0
  });

  // Función para cargar datos reales (Conectada al Backend)
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Usamos el servicio para traer todo de una vez
      const data = await agentService.getDashboardStats(user.id);
      setStats(data);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      
      <div className="flex-1">
        <Header 
          title="Dashboard de Agente" 
          subtitle={`Bienvenido, ${user?.user_metadata?.full_name || 'Agente'}`}
        />

        <div className="p-6 md:p-8 space-y-8">
          
          {/* SECCIÓN 0: KPIs RÁPIDOS (Nuevo agregad para ver métricas al instante) */}
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

          {/* SECCIÓN 1: NOTICIAS Y FINANZAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <AgentNewsWall />
            </div>

            {/* Columna derecha (Resumen Financiero Real) */}
            <div className="space-y-6">
               <Card variant="bordered" className="border-emerald-200 bg-emerald-50/30 p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-full flex-shrink-0">
                        <TrendingUp className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-emerald-800 font-medium">Ventas del mes</p>
                      <p className="text-3xl font-bold text-emerald-700">
                        {/* Formateador de moneda automático */}
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.monthRevenue)}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1 font-medium">
                        {stats.monthBookings} reservas cerradas este mes
                      </p>
                    </div>
                  </div>
               </Card>

               {/* Menú de Accesos Rápidos */}
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-bold text-gray-800 text-sm mb-3">Gestión Rápida</h3>
                  <div className="space-y-1">
                    <Link href="/agent/dashboard/bookings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600 hover:bg-gray-50 px-2 py-2 rounded transition">
                        <ArrowRight size={14} /> Ver todas mis reservas
                    </Link>
                    <Link href="/agent/dashboard/tickets" className="flex items-center gap-2 text-sm text-gray-600 hover:text-brand-600 hover:bg-gray-50 px-2 py-2 rounded transition">
                        <ArrowRight size={14} /> Reportar problema (Ticket)
                    </Link>
                  </div>
               </div>
            </div>
          </div>

          {/* SECCIÓN 2: COTIZADOR RÁPIDO */}
          <Card className="p-6 bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#0F2545] flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-500" />
                Cotizador Rápido
              </h2>
              <span className="text-xs font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200">
                MODO AGENTE: NETO
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" placeholder="Origen (ej. HAV)" className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              <input type="text" placeholder="Destino (ej. MIA)" className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              <input type="date" className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              <Button variant="primary" className="h-full">Buscar Disponibilidad</Button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}