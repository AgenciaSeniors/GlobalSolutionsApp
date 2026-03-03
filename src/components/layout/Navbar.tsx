/**
 * @fileoverview Main navigation bar with scroll-aware glass morphism,
 * mobile drawer and role-aware links.
 * @module components/layout/Navbar
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Plane, Car, Sparkles, Home, LogIn } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import Button from '@/components/ui/Button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { UserRole } from '@/types/models';

const NAV_LINKS = [
  { href: ROUTES.HOME, labelKey: 'nav.home', icon: Home },
  { href: ROUTES.FLIGHTS, labelKey: 'nav.flights', icon: Plane },
  { href: ROUTES.CARS, labelKey: 'nav.cars', icon: Car },
  { href: ROUTES.OFFERS, labelKey: 'nav.offers', icon: Sparkles },
  { href: ROUTES.ABOUT, labelKey: 'nav.about', icon: null },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile } = useAuthContext();
  const { language, setLanguage, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Estado para la notificación del agente
  const [showAgentNotification, setShowAgentNotification] = useState(false);

  const dashboardRoute: Record<UserRole, string> = {
    admin: ROUTES.ADMIN_DASHBOARD,
    agent: ROUTES.AGENT_DASHBOARD,
    client: ROUTES.USER_DASHBOARD,
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lógica de la Notificación del Agente
  useEffect(() => {
    if (profile?.role === 'agent') {
      const hasSeen = localStorage.getItem('has_seen_agent_welcome');
      if (!hasSeen) setShowAgentNotification(true);
    }

    // Escuchar cuando limpie la notificación desde la otra pantalla
    const handleSeen = () => setShowAgentNotification(false);
    window.addEventListener('agent_welcome_seen', handleSeen);

    return () => window.removeEventListener('agent_welcome_seen', handleSeen);
  }, [profile?.role]);

  // Close drawer on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  const dashboardHref =
    profile?.role ? dashboardRoute[profile.role] || ROUTES.USER_DASHBOARD : ROUTES.USER_DASHBOARD;

  const avatarLetter = (profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase();

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-brand-100 transition-all',
        scrolled ? 'bg-white shadow-sm' : 'bg-white/80 backdrop-blur'
      )}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        {/* ── Logo ── */}
        <Link href={ROUTES.HOME} className="flex items-center gap-0 px-2 py-2">
          <Image
            src="/brand/avion-check.png"
            alt="Global Solutions Travel"
            width={60}
            height={60}
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain shrink-0"
            priority
          />
          <span className="-ml-2 sm:-ml-3 leading-none">
            <span className="font-display text-base font-bold tracking-wide text-navy sm:text-xl">
              GLOBAL SOLUTIONS{' '}
            </span>
            <span className="font-script text-base font-bold text-coral sm:text-xl">Travel</span>
          </span>
        </Link>

        {/* ── Desktop Links ── */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, labelKey, icon: Icon }) => {
            const active =
              href === ROUTES.HOME
                ? pathname === '/'
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-900'
                      : 'text-brand-700 hover:bg-brand-50 hover:text-brand-900'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ── Auth Actions ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-brand-200 px-2 py-1">
            <label htmlFor="language-switcher" className="text-xs font-semibold text-brand-700">
              {t('lang.label')}
            </label>
            <select
              id="language-switcher"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
              className="bg-transparent text-sm font-semibold text-brand-900 outline-none"
              aria-label={t('lang.label')}
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </div>

          {user ? (
            <Link
              href={dashboardHref}
              className="relative inline-flex items-center gap-2 shrink-0
                         rounded-full border-2 border-brand-200 bg-white/80
                         px-2 py-1.5 sm:px-3 sm:py-2 text-brand-900
                         hover:bg-brand-50 hover:border-brand-300
                         transition-all duration-200 ease-out
                         hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
              aria-label={t('nav.profile')}
            >
              {/* Notificación Roja Mágica */}
              {showAgentNotification && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
              )}

              <span
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center shrink-0 rounded-full
                           bg-brand-100 text-xs font-bold text-brand-800 ring-1 ring-brand-200"
                aria-hidden="true"
              >
                {avatarLetter}
              </span>

              <span className="hidden sm:inline whitespace-nowrap text-sm font-semibold leading-none">{t('nav.profile')}</span>
            </Link>
          ) : (
            <Link href={ROUTES.LOGIN}>
              <Button size="sm" className="hidden sm:inline-flex">{t('nav.login')}</Button>
              <Button size="sm" className="sm:hidden gap-1.5">
                <LogIn className="h-4 w-4" />
                {t('nav.enter')}
              </Button>
            </Link>
          )}

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-xl p-2 text-brand-900 hover:bg-brand-50 md:hidden"
            aria-label={t('nav.openMenu')}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div className="absolute inset-x-0 top-[72px] border-t border-brand-100 bg-white/95 backdrop-blur-xl p-4 sm:p-6 shadow-xl md:hidden animate-fade-in">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-brand-200 px-4 py-3">
            <span className="text-sm font-semibold text-brand-800">{t('lang.label')}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
              className="bg-transparent text-sm font-semibold text-brand-900 outline-none"
              aria-label={t('lang.label')}
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </div>

          <ul className="flex flex-col gap-2">
            {NAV_LINKS.map(({ href, labelKey, icon: Icon }) => {
              const active =
                href === ROUTES.HOME
                  ? pathname === '/'
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors',
                      active
                        ? 'bg-brand-50 text-brand-900'
                        : 'text-brand-800 hover:bg-brand-50'
                    )}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {t(labelKey)}
                  </Link>
                </li>
              );
            })}

            <li className="mt-4 relative">
              {user ? (
                <Link href={dashboardHref}>
                  {showAgentNotification && (
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4 z-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                    </span>
                  )}
                  <Button className="w-full relative">{t('nav.profile')}</Button>
                </Link>
              ) : (
                <Link href={ROUTES.LOGIN}>
                  <Button className="w-full">{t('nav.login')}</Button>
                </Link>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
