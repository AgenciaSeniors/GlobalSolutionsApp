/**
 * @fileoverview Shared SEO utilities — base URL, canonical builder, OG defaults.
 * @module lib/seo/metadata
 */
import type { Metadata } from 'next';

/* ── Constants ── */

export const SITE_NAME = 'Global Solutions Travel';
export const SITE_DOMAIN = 'globalsolutiontravel.com';

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || `https://${SITE_DOMAIN}`;
}

export const SEO_DEFAULTS = {
  siteName: SITE_NAME,
  locale: 'es_419' as const,
  description:
    'Agencia de viajes para vuelos internacionales a Cuba y el mundo. Más de 60 aerolíneas, renta de autos en Cuba con Transtur. Paga con Zelle, PIX, SPEI o Square.',
  keywords: [
    'vuelos a Cuba',
    'vuelos baratos',
    'renta de autos Cuba',
    'Transtur Cuba',
    'vuelos internacionales',
    'agencia de viajes',
    'charter a Cuba',
    'vuelos La Habana',
    'pasajes a Cuba',
    'comprar vuelos con Zelle',
    'PIX vuelos',
    'SPEI vuelos',
    'vuelos Miami Habana',
    'vuelos Panama Cuba',
    'ofertas de vuelos',
    'Cuba',
  ],
} as const;

/* ── Builders ── */

/** Full canonical URL for a given path */
export function buildCanonical(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Standard OpenGraph metadata with overrides */
export function buildOgMeta(overrides: Partial<Metadata['openGraph']> = {}): Metadata['openGraph'] {
  return {
    type: 'website',
    siteName: SEO_DEFAULTS.siteName,
    locale: SEO_DEFAULTS.locale,
    ...overrides,
  };
}

/** Build a complete Metadata object for a page */
export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  ogImage,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}): Metadata {
  const meta: Metadata = {
    title,
    description,
    alternates: { canonical: path },
    openGraph: buildOgMeta({
      title,
      description,
      url: path,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    }),
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };

  if (keywords?.length) {
    meta.keywords = keywords;
  }

  if (noIndex) {
    meta.robots = { index: false, follow: false };
  }

  return meta;
}
