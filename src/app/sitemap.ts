/**
 * @fileoverview Dynamic XML sitemap — static + DB-driven pages.
 * @module app/sitemap
 */
import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_DOMAIN } from '@/lib/seo/metadata';

const BASE_URL = `https://${SITE_DOMAIN}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  /* ── Static pages ── */
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/flights`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/cars`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/offers`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/reviews`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/legal/contact`, changeFrequency: 'yearly', priority: 0.3 },

    /* ── SEO landing pages: Routes ── */
    { url: `${BASE_URL}/flights/cuba`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/flights/charter-cuba`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flights/miami-habana`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flights/panama-habana`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flights/new-york-cuba`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flights/cancun-habana`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/flights/mexico-cuba`, changeFrequency: 'weekly', priority: 0.8 },

    /* ── SEO landing pages: Payment & Guides ── */
    { url: `${BASE_URL}/metodos-de-pago`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guia/requisitos-viajar-cuba`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guia/aduana-cuba-equipaje`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/guia/evisa-cuba-como-tramitar`, changeFrequency: 'monthly', priority: 0.7 },
  ];

  /* ── Dynamic car pages ── */
  const { data: cars } = await supabase
    .from('car_rentals')
    .select('id, updated_at')
    .eq('is_active', true);

  const carPages: MetadataRoute.Sitemap = (cars ?? []).map((car) => ({
    url: `${BASE_URL}/cars/${car.id}`,
    lastModified: new Date(car.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  /* ── Dynamic offer pages ── */
  const { data: offers } = await supabase
    .from('special_offers')
    .select('id, updated_at')
    .eq('is_active', true);

  const offerPages: MetadataRoute.Sitemap = (offers ?? []).map((offer) => ({
    url: `${BASE_URL}/offers/${offer.id}`,
    lastModified: new Date(offer.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...carPages, ...offerPages];
}
