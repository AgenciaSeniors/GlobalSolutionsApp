/**
 * @fileoverview Agent (gestor) dashboard.
 * @module app/(dashboard)/agent/dashboard/page
 */
import type { Metadata } from 'next';
import Sidebar, { AGENT_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { CalendarCheck, Users, DollarSign } from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard Gestor' };

export default function AgentDashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar links={AGENT_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Dashboard de Gestor"
          subtitle="Reservas asignadas y métricas"
        />
        <div className="p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { label: 'Reservas Pendientes', value: '8', icon: CalendarCheck, color: 'text-amber-500' },
              { label: 'Clientes Activos', value: '23', icon: Users, color: 'text-brand-600' },
              { label: 'Ventas del Mes', value: '$12,450', icon: DollarSign, color: 'text-emerald-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} variant="bordered">
                <div className="flex items-center gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 ${color}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm text-neutral-500">{label}</p>
                    <p className="text-2xl font-bold text-neutral-900">{value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
