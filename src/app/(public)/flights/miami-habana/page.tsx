/**
 * @fileoverview SEO landing: Miami → La Habana route.
 * Target: "vuelos Miami a La Habana" (20,000–30,000/mo combined)
 * @module app/(public)/flights/miami-habana/page
 */
import type { Metadata } from 'next';
import RoutePageTemplate from '@/components/seo/RoutePageTemplate';
import { getRouteBySlug } from '@/lib/seo/routes-data';

const route = getRouteBySlug('miami-habana')!;

export const metadata: Metadata = {
  title: route.metaTitle,
  description: route.metaDescription,
  alternates: { canonical: `/flights/${route.slug}` },
  keywords: [
    'vuelos Miami a La Habana',
    'vuelos de Miami a Cuba',
    'vuelos baratos Miami Habana',
    'precio vuelo Miami La Habana',
    'charter a Cuba desde Miami',
  ],
  openGraph: {
    title: route.metaTitle,
    description: route.metaDescription,
    url: `/flights/${route.slug}`,
  },
};

export default function MiamiHabanaPage() {
  return <RoutePageTemplate route={route} />;
}
