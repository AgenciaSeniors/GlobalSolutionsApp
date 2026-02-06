/**
 * @fileoverview Client dashboard — shows bookings summary and quick actions.
 * @module app/(dashboard)/user/dashboard/page
 */
import type { Metadata } from 'next';
import Sidebar, { USER_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import { CalendarCheck, Plane, Star } from 'lucide-react';

export const metadata: Metadata = { title: 'Mi Dashboard' };

const STAT_CARDS = [
  { label: 'Reservas Activas', value: '2', icon: CalendarCheck, color: 'text-brand-600' },
  { label: 'Vuelos Completados', value: '5', icon: Plane, color: 'text-emerald-600' },
  { label: 'Puntos de Lealtad', value: '1,250', icon: Star, color: 'text-amber-500' },
];

export default function UserDashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar links={USER_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Mi Dashboard"
          subtitle="Resumen de tu actividad reciente"
        />
        <div className="p-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
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
