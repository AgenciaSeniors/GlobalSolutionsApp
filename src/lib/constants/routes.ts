/**
 * @fileoverview Centralised route map — all application routes.
 * @module lib/constants/routes
 */

export const ROUTES = {
  HOME: '/',
  FLIGHTS: '/flights',
  FLIGHT_SEARCH: '/flights/search',
  CARS: '/cars',
  OFFERS: '/offers',
  ABOUT: '/about',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',

  // Legal
  TERMS: '/legal/terms',
  CONTACT: '/legal/contact',

  // Dashboards
  USER_DASHBOARD: '/user/dashboard',
  USER_BOOKINGS: '/user/dashboard/bookings',

  AGENT_DASHBOARD: '/agent/dashboard',
  AGENT_NEWS: '/agent/dashboard/news',

  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_BOOKINGS: '/admin/dashboard/bookings',
  ADMIN_EMISSION: '/admin/dashboard/emission',
  ADMIN_FLIGHTS: '/admin/dashboard/flights',
  ADMIN_MARKUP: '/admin/dashboard/markup',
  ADMIN_OFFERS: '/admin/dashboard/offers',
  ADMIN_AGENTS: '/admin/dashboard/agents',
  ADMIN_NEWS: '/admin/dashboard/news',
  ADMIN_REVIEWS: '/admin/dashboard/reviews',
  ADMIN_QUOTATIONS: '/admin/dashboard/quotations',
  ADMIN_TICKETS: '/admin/dashboard/tickets',
  ADMIN_SETTINGS: '/admin/dashboard/settings',
  ADMIN_CARS: '/admin/dashboard/cars',

  // SEO landing pages — Routes
  FLIGHTS_CUBA: '/flights/cuba',
  FLIGHTS_CHARTER_CUBA: '/flights/charter-cuba',
  FLIGHTS_MIAMI_HABANA: '/flights/miami-habana',
  FLIGHTS_PANAMA_HABANA: '/flights/panama-habana',
  FLIGHTS_NYC_CUBA: '/flights/new-york-cuba',
  FLIGHTS_CANCUN_HABANA: '/flights/cancun-habana',
  FLIGHTS_MEXICO_CUBA: '/flights/mexico-cuba',

  // SEO landing pages — Payment & Guides
  PAYMENT_METHODS: '/metodos-de-pago',
  GUIDE_REQUISITOS_CUBA: '/guia/requisitos-viajar-cuba',
  GUIDE_ADUANA_CUBA: '/guia/aduana-cuba-equipaje',
  GUIDE_EVISA_CUBA: '/guia/evisa-cuba-como-tramitar',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
