/**
 * @fileoverview SEO landing: Panamá → La Habana route.
 * Target: "vuelos Panama a La Habana" (2,000–4,000/mo, LOW difficulty — VERY HIGH rank chance)
 * @module app/(public)/flights/panama-habana/page
 */
import type { Metadata } from 'next';
import RoutePageTemplate from '@/components/seo/RoutePageTemplate';
import { getRouteBySlug } from '@/lib/seo/routes-data';

const route = getRouteBySlug('panama-habana')!;

export const metadata: Metadata = {
  title: route.metaTitle,
  description: route.metaDescription,
  alternates: { canonical: `/flights/${route.slug}` },
  keywords: [
    'vuelos de Panama a La Habana',
    'vuelos Panama Cuba',
    'vuelos baratos Panama Cuba',
    'Copa Airlines Panama Habana',
    'vuelos a Cuba con escala en Panama',
  ],
  openGraph: {
    title: route.metaTitle,
    description: route.metaDescription,
    url: `/flights/${route.slug}`,
  },
};

export default function PanamaHabanaPage() {
  return <RoutePageTemplate route={route} />;
}
