'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  Briefcase, LayoutDashboard, Plane, CalendarCheck, Star, Settings,
  ChevronLeft, LogOut, Newspaper, Tag,
  Users, FileText, Trophy, Car, DollarSign, Camera, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SidebarLink {
  href: string;
  label: string;
  description?: string;
  icon: React.ElementType;
}

interface SidebarProps {
  links: SidebarLink[];
}

export default function Sidebar({ links }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuthContext();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Estado para la notificación de agente aprobado
  const [showAgentNotification, setShowAgentNotification] = useState(false);

  useEffect(() => {
    if (profile?.role === 'agent') {
      try {
        const hasSeen = localStorage.getItem('has_seen_agent_welcome');
        if (!hasSeen) setShowAgentNotification(true);
      } catch { /* noop */ }
    }

    const handleSeen = () => setShowAgentNotification(false);
    window.addEventListener('agent_welcome_seen', handleSeen);
    return () => window.removeEventListener('agent_welcome_seen', handleSeen);
  }, [profile?.role]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Floating hamburger button — mobile only */}
      <button
        className="fixed left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform active:scale-95 md:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          // Mobile: fixed drawer, slides in/out
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-neutral-200 bg-white transition-transform duration-300 w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: sticky in-flow, override mobile styles
          'md:relative md:sticky md:top-0 md:h-screen md:translate-x-0 md:transition-all md:duration-300',
          collapsed ? 'md:w-[72px]' : 'md:w-64',
        )}
      >
        {/* Logo area */}
        <div className={cn(
          'flex h-16 shrink-0 items-center border-b border-neutral-100 px-3',
          collapsed ? 'md:justify-center' : 'justify-between',
        )}>
          {/* Logo text — always shown on mobile, hidden when desktop-collapsed */}
          <div className={cn('flex items-center gap-2 px-2', collapsed && 'md:hidden')}>
            <span className="text-lg font-heading font-bold text-navy">GS</span>
            <span className="text-sm font-script text-coral">Travel</span>
          </div>

          {/* Desktop collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <ChevronLeft
              className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')}
            />
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="flex md:hidden rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map(({ href, label, description, icon: Icon }) => {
            const active = pathname === href;
            const isAgentLink = href === '/user/dashboard/become-agent';

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-coral/10 text-coral'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-coral',
                )}
                title={collapsed ? (description ? `${label} — ${description}` : label) : undefined}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {collapsed && isAgentLink && showAgentNotification && (
                    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full border border-white bg-red-500" />
                  )}
                </div>

                {/* Label — always shown on mobile, hidden when desktop-collapsed */}
                <div className={cn('min-w-0 flex-1 flex justify-between items-center', collapsed && 'md:hidden')}>
                  <div>
                    <div className="leading-tight">
                      {isAgentLink && showAgentNotification ? '¡Solicitud Aprobada!' : label}
                    </div>
                    {description && (
                      <div className="text-xs font-normal text-neutral-400 leading-snug mt-0.5">
                        {description}
                      </div>
                    )}
                  </div>

                  {isAgentLink && showAgentNotification && (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <div
          className="shrink-0 border-t border-neutral-100 p-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={cn(collapsed && 'md:hidden')}>
              {isLoggingOut ? 'Saliendo...' : 'Cerrar Sesión'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

/** Pre-configured link sets for each role. */
export const USER_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/dashboard/bookings', label: 'Mis Reservas', icon: CalendarCheck },
  { href: '/user/dashboard/reviews', label: 'Mis Reseñas', icon: Star },
  { href: '/user/dashboard/loyalty', label: 'Mis Puntos', icon: Trophy },
  { href: '/user/dashboard/become-agent', label: 'Convertirse en Agente', icon: Briefcase },
  { href: '/user/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const AGENT_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agent/dashboard/news', label: 'Muro de Noticias', icon: Newspaper },
  { href: '/agent/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const ADMIN_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/emission', label: 'Emisión de Boletos', icon: FileText },
  { href: '/admin/dashboard/bookings', label: 'Todas las Reservas', icon: CalendarCheck },
  { href: '/admin/dashboard/flights', label: 'Markup', icon: DollarSign },
  { href: '/admin/dashboard/offers', label: 'Ofertas Visuales', icon: Tag },
  { href: '/admin/dashboard/experiences', label: 'Exp. de Clientes', icon: Camera },
  { href: '/admin/dashboard/agents', label: 'Gestores', icon: Users },
  { href: '/admin/dashboard/news', label: 'Noticias Agentes', icon: Newspaper },
  { href: '/admin/dashboard/cars', label: 'Autos', icon: Car },
  { href: '/admin/dashboard/reviews', label: 'Moderar Reseñas', icon: Star },
  { href: '/admin/dashboard/settings', label: 'Configuración', icon: Settings },
];
