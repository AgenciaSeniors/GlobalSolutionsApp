/**
 * @fileoverview Admin dashboard with system overview.
 * @module app/(dashboard)/admin/dashboard/page
 */
import type { Metadata } from 'next';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { CalendarCheck, Users, DollarSign, Plane, ShieldCheck, Star } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin Dashboard' };

export default function AdminDashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Panel de Administración"
          subtitle="Vista general del sistema"
        />
        <div className="p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Total Reservas', value: '1,247', icon: CalendarCheck, color: 'text-brand-600' },
              { label: 'Usuarios Registrados', value: '5,032', icon: Users, color: 'text-indigo-600' },
              { label: 'Ingresos del Mes', value: '$87,430', icon: DollarSign, color: 'text-emerald-600' },
              { label: 'Vuelos Activos', value: '156', icon: Plane, color: 'text-cyan-600' },
              { label: 'Gestores Activos', value: '12', icon: ShieldCheck, color: 'text-violet-600' },
              { label: 'Reseñas Pendientes', value: '8', icon: Star, color: 'text-amber-500' },
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
