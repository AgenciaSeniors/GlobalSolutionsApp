/**
 * @fileoverview SEO landing: CDMX → Cuba route.
 * Target: "vuelos de México a Cuba" (8,000–15,000/mo)
 * @module app/(public)/flights/mexico-cuba/page
 */
import type { Metadata } from 'next';
import RoutePageTemplate from '@/components/seo/RoutePageTemplate';
import { getRouteBySlug } from '@/lib/seo/routes-data';

const route = getRouteBySlug('mexico-cuba')!;

export const metadata: Metadata = {
  title: route.metaTitle,
  description: route.metaDescription,
  alternates: { canonical: `/flights/${route.slug}` },
  keywords: [
    'vuelos de México a Cuba',
    'vuelos CDMX a La Habana',
    'vuelos baratos a Cuba desde México',
    'Aeromexico Cuba',
  ],
  openGraph: {
    title: route.metaTitle,
    description: route.metaDescription,
    url: `/flights/${route.slug}`,
  },
};

export default function MexicoCubaPage() {
  return <RoutePageTemplate route={route} />;
}
