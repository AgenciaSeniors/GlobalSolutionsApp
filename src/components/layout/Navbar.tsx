/**
 * @fileoverview Main navigation bar with scroll-aware glass morphism,
 *               mobile drawer and role-aware links.
 * @module components/layout/Navbar
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Plane, Car, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import type { UserRole } from '@/types/models';

const NAV_LINKS = [
  { href: ROUTES.FLIGHTS, label: 'Vuelos', icon: Plane },
  { href: ROUTES.CARS, label: 'Autos', icon: Car },
  { href: ROUTES.OFFERS, label: 'Ofertas', icon: Sparkles },
  { href: ROUTES.ABOUT, label: 'Nosotros', icon: null },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile } = useAuthContext();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardRoute: Record<UserRole, string> = {
    admin: ROUTES.ADMIN_DASHBOARD,
    agent: ROUTES.AGENT_DASHBOARD,
    client: ROUTES.USER_DASHBOARD,
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
  ? 'bg-white/90 backdrop-blur-xl border-b border-brand-100 shadow-sm'
  : 'bg-transparent',

      )}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        {/* ── Logo ── */}
        <Link href={ROUTES.HOME} className="flex items-center gap-3 py-1">

          <Image
            src="/brand/logo.png"

            alt="Global Solutions Travel"
            width={170}
            height={48}
            className="h-16 w-auto"
            priority
          />
        </Link>

        {/* ── Desktop Links ── */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
active
  ? 'bg-brand-50 text-brand-900'
  : 'text-brand-700 hover:bg-brand-50 hover:text-brand-900',

                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ── Auth Actions ── */}
        <div className="flex items-center gap-3">
          {user && profile ? (
            <Link href={dashboardRoute[profile.role] || ROUTES.USER_DASHBOARD} className="hidden sm:block">
              <Button size="sm" variant="outline" className="gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
                Mi Panel
              </Button>
            </Link>
          ) : (
            <Link href={ROUTES.LOGIN} className="hidden sm:block">
              <Button size="sm">Iniciar Sesión</Button>
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl p-2 text-brand-900 hover:bg-brand-50 md:hidden"

            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
       <div className="absolute inset-x-0 top-[72px] border-t border-brand-100 bg-white/95 backdrop-blur-xl p-6 shadow-xl md:hidden animate-fade-in">

          <ul className="flex flex-col gap-2">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors',
pathname === href
  ? 'bg-brand-50 text-brand-900'
  : 'text-brand-800 hover:bg-brand-50',

                  )}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  {label}
                </Link>
              </li>
            ))}
            <li className="mt-4">
              <Link href={ROUTES.LOGIN}>
                <Button className="w-full">Iniciar Sesión</Button>
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
