/**
 * @fileoverview SEO landing: Cancún → La Habana route.
 * Target: "vuelos Cancún a La Habana" (4,000–8,000/mo)
 * @module app/(public)/flights/cancun-habana/page
 */
import type { Metadata } from 'next';
import RoutePageTemplate from '@/components/seo/RoutePageTemplate';
import { getRouteBySlug } from '@/lib/seo/routes-data';

const route = getRouteBySlug('cancun-habana')!;

export const metadata: Metadata = {
  title: route.metaTitle,
  description: route.metaDescription,
  alternates: { canonical: `/flights/${route.slug}` },
  keywords: [
    'vuelos Cancún a La Habana',
    'vuelos de Cancún a Cuba',
    'boletos de avion a Cuba desde Cancun',
    'Cubana de Aviación Cancún',
  ],
  openGraph: {
    title: route.metaTitle,
    description: route.metaDescription,
    url: `/flights/${route.slug}`,
  },
};

export default function CancunHabanaPage() {
  return <RoutePageTemplate route={route} />;
}
