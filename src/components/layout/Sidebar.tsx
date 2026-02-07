/**
 * @fileoverview Collapsible sidebar for dashboard layouts (admin/agent/user).
 * @module components/layout/Sidebar
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plane,
  CalendarCheck,
  Star,
  Settings,
  ChevronLeft,
  LogOut,
  Newspaper,
  MessageSquare,
  Tag,
  Users,
  FileText,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface SidebarProps {
  links: SidebarLink[];
}

export default function Sidebar({ links }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-neutral-200 bg-white transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Collapse toggle */}
      <div className="flex h-16 items-center justify-end border-b border-neutral-100 px-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <ChevronLeft
            className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-brand-600',
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-neutral-100 p-3">
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-accent-red"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}

/** Pre-configured link sets for each role. */
export const USER_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/dashboard/bookings', label: 'Mis Reservas', icon: CalendarCheck },
  { href: '/user/dashboard/reviews', label: 'Mis Reseñas', icon: Star },
  { href: '/user/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const AGENT_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agent/dashboard/news', label: 'Muro de Noticias', icon: Newspaper },
  { href: '/agent/dashboard/tickets', label: 'Tickets Internos', icon: MessageSquare },
  { href: '/agent/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const ADMIN_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/emission', label: 'Emisión de Boletos', icon: FileText },
  { href: '/admin/dashboard/bookings', label: 'Todas las Reservas', icon: CalendarCheck },
  { href: '/admin/dashboard/flights', label: 'Vuelos & Markup', icon: Plane },
  { href: '/admin/dashboard/offers', label: 'Ofertas Visuales', icon: Tag },
  { href: '/admin/dashboard/quotations', label: 'Cotizaciones', icon: HelpCircle },
  { href: '/admin/dashboard/agents', label: 'Gestores', icon: Users },
  { href: '/admin/dashboard/news', label: 'Noticias Agentes', icon: Newspaper },
  { href: '/admin/dashboard/tickets', label: 'Tickets Soporte', icon: MessageSquare },
  { href: '/admin/dashboard/reviews', label: 'Moderar Reseñas', icon: Star },
  { href: '/admin/dashboard/settings', label: 'Configuración', icon: Settings },
];
