'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useAuthContext } from '@/components/providers/AuthProvider';
import {
  Briefcase, LayoutDashboard, Plane, CalendarCheck, Star, Settings,
  ChevronLeft, LogOut, Newspaper, MessageSquare, Tag,
  Users, FileText, HelpCircle, DollarSign, Trophy, Car,
  Route,
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
  
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Estado para la notificación de agente aprobado
  const [showAgentNotification, setShowAgentNotification] = useState(false);

  useEffect(() => {
    if (profile?.role === 'agent') {
      const hasSeen = localStorage.getItem('has_seen_agent_welcome');
      if (!hasSeen) setShowAgentNotification(true);
    }
    
    // Escuchar cuando limpie la notificación
    const handleSeen = () => setShowAgentNotification(false);
    window.addEventListener('agent_welcome_seen', handleSeen);
    
    return () => window.removeEventListener('agent_welcome_seen', handleSeen);
  }, [profile?.role]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.signOut();
      
      // Forzamos la redirección al login y refrescamos el estado del servidor
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-neutral-200 bg-white transition-all duration-300 sticky top-0',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Logo area */}
      <div className={cn(
        'flex h-16 items-center border-b border-neutral-100 px-3',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-lg font-heading font-bold text-navy">GS</span>
            <span className="text-sm font-script text-coral">Travel</span>
          </div>
        )}
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
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
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
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-red-500 border border-white"></span>
                )}
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1 flex justify-between items-center">
                  <div>
                    <div className="leading-tight">{isAgentLink && showAgentNotification ? '¡Solicitud Aprobada!' : label}</div>
                    {description && (
                      <div className="text-xs font-normal text-neutral-400 leading-snug mt-0.5">
                        {description}
                      </div>
                    )}
                  </div>
                  
                  {isAgentLink && showAgentNotification && (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-neutral-100 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{isLoggingOut ? 'Saliendo...' : 'Cerrar Sesión'}</span>}
        </button>
      </div>
    </aside>
  );
}

/** Pre-configured link sets for each role. */
export const USER_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/user/dashboard/create-route', label: 'Crear Ruta', icon: Route},
  { href: '/user/dashboard/bookings', label: 'Mis Reservas', icon: CalendarCheck },
  { href: '/user/dashboard/reviews', label: 'Mis Reseñas', icon: Star },
  { href: '/user/dashboard/loyalty', label: 'Mis Puntos', icon: Trophy },
  { href: '/user/dashboard/become-agent', label: 'Convertirse en Agente', icon: Briefcase },
  { href: '/user/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const AGENT_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agent/dashboard/bookings', label: 'Reservas Asignadas', icon: CalendarCheck },
  { href: '/agent/dashboard/news', label: 'Muro de Noticias', icon: Newspaper },
  { href: '/agent/dashboard/settings', label: 'Configuración', icon: Settings },
];

export const ADMIN_SIDEBAR_LINKS: SidebarLink[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/emission', label: 'Emisión de Boletos', icon: FileText },
  { href: '/admin/dashboard/bookings', label: 'Todas las Reservas', icon: CalendarCheck },
  { href: '/admin/dashboard/flights', label: 'Vuelos & Markup', icon: Plane },
  { href: '/admin/dashboard/offers', label: 'Ofertas Visuales', icon: Tag },
  { href: '/admin/dashboard/agents', label: 'Gestores', icon: Users },
  { href: '/admin/dashboard/news', label: 'Noticias Agentes', icon: Newspaper },
  { href: '/admin/dashboard/reviews', label: 'Moderar Reseñas', icon: Star },
  { href: '/admin/dashboard/settings', label: 'Configuración', icon: Settings },
];