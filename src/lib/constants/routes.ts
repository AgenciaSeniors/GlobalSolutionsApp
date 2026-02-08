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
  QUOTE_REQUEST: '/quote-request',

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
  AGENT_TICKETS: '/agent/dashboard/tickets',

  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_BOOKINGS: '/admin/dashboard/bookings',
  ADMIN_EMISSION: '/admin/dashboard/emission',
  ADMIN_FLIGHTS: '/admin/dashboard/flights',
  ADMIN_OFFERS: '/admin/dashboard/offers',
  ADMIN_AGENTS: '/admin/dashboard/agents',
  ADMIN_NEWS: '/admin/dashboard/news',
  ADMIN_REVIEWS: '/admin/dashboard/reviews',
  ADMIN_QUOTATIONS: '/admin/dashboard/quotations',
  ADMIN_TICKETS: '/admin/dashboard/tickets',
  ADMIN_SETTINGS: '/admin/dashboard/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
