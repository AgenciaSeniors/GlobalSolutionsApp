/**
 * @fileoverview SEO landing: NYC → Cuba route.
 * Target: "vuelos Nueva York a Cuba" (3,000–6,000/mo, US Hispanic gap)
 * @module app/(public)/flights/new-york-cuba/page
 */
import type { Metadata } from 'next';
import RoutePageTemplate from '@/components/seo/RoutePageTemplate';
import { getRouteBySlug } from '@/lib/seo/routes-data';

const route = getRouteBySlug('new-york-cuba')!;

export const metadata: Metadata = {
  title: route.metaTitle,
  description: route.metaDescription,
  alternates: { canonical: `/flights/${route.slug}` },
  keywords: [
    'vuelos de Nueva York a Cuba',
    'vuelos JFK a La Habana',
    'vuelos baratos Nueva York Habana',
    'vuelos New York Cuba',
  ],
  openGraph: {
    title: route.metaTitle,
    description: route.metaDescription,
    url: `/flights/${route.slug}`,
  },
};

export default function NewYorkCubaPage() {
  return <RoutePageTemplate route={route} />;
}
