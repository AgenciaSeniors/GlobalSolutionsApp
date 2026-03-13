/**
 * @fileoverview noindex layout for /flights/search — infinite URL permutations.
 * @module app/(public)/flights/search/layout
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FlightSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
