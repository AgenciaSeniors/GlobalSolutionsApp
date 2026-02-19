/**
 * @fileoverview Floating "Back to Home" button shown across the app.
 * @module components/layout/HomeFloatingButton
 */

import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';

export default function HomeFloatingButton() {
  return (
    <Link
      href={ROUTES.HOME}
      aria-label="Volver al inicio"
      title="Volver al inicio"
      className="fixed bottom-6 left-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/25 transition-all hover:scale-105 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
    >
      {/* Casita en líneas blancas */}
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 10v11a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />
      </svg>
    </Link>
  );
}
