/**
 * @fileoverview Centralised route map used by Navbar, redirects, breadcrumbs, etc.
 * @module lib/constants/routes
 */

export const ROUTES = {
  HOME: '/',
  FLIGHTS: '/flights',
  FLIGHT_SEARCH: '/flights/search',
  CARS: '/cars',
  OFFERS: '/offers',
  ABOUT: '/about',

  LOGIN: '/login',
  REGISTER: '/register',

  USER_DASHBOARD: '/user/dashboard',
  AGENT_DASHBOARD: '/agent/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
