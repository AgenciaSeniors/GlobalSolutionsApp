/**
 * @fileoverview JSON-LD structured data generators for Schema.org.
 * Each function returns a plain object; use <JsonLd> component to render.
 * @module lib/seo/jsonld
 */
import { getBaseUrl, SITE_NAME } from './metadata';
import type { ReviewStats } from './review-stats';

/* ── Types ── */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export interface RouteSchemaData {
  originCity: string;
  originCode: string;
  destinationCity: string;
  destinationCode: string;
  lowPrice: number;
  highPrice?: number;
  airlines: string[];
}

export interface AutoRentalSchemaData {
  name: string;
  description: string;
  lowPrice: number;
  highPrice?: number;
  provider: string;
  areaServed: string;
  image?: string;
}

export interface ArticleSchemaData {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  image?: string;
}

export interface HowToStep {
  name: string;
  text: string;
}

/* ── Review helpers ── */

/** Build aggregateRating + review properties for a Product schema */
export function buildProductReviewProps(stats: ReviewStats | null) {
  if (!stats || stats.reviewCount === 0) return {};

  const props: Record<string, unknown> = {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: stats.ratingValue,
      bestRating: 5,
      worstRating: 1,
      reviewCount: stats.reviewCount,
    },
  };

  if (stats.bestReview) {
    props.review = {
      '@type': 'Review',
      author: { '@type': 'Person', name: stats.bestReview.author },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: stats.bestReview.rating,
        bestRating: 5,
      },
      reviewBody: stats.bestReview.body,
    };
  }

  return props;
}

/* ── Generators ── */

/** Organization — appears on homepage */
export function buildOrganizationSchema() {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: base,
    logo: `${base}/brand/logo.png`,
    description:
      'Agencia de viajes especializada en vuelos a Cuba y renta de autos. Más de 60 aerolíneas, soporte 24/7.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Spanish', 'English'],
      areaServed: ['MX', 'CU', 'CO', 'PA', 'US', 'BR', 'ES'],
    },
    paymentAccepted: ['Zelle', 'PIX', 'SPEI', 'Square', 'Credit Card'],
    areaServed: [
      { '@type': 'Country', name: 'Cuba' },
      { '@type': 'Country', name: 'México' },
      { '@type': 'Country', name: 'Colombia' },
      { '@type': 'Country', name: 'Panamá' },
      { '@type': 'Country', name: 'Estados Unidos' },
      { '@type': 'Country', name: 'Brasil' },
      { '@type': 'Country', name: 'España' },
    ],
  };
}

/** WebSite with SearchAction — appears on homepage */
export function buildWebSiteSchema() {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/flights?from={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** BreadcrumbList */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${base}${item.href}`,
    })),
  };
}

/** FAQPage */
export function buildFAQSchema(faqs: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/** Flight route with AggregateOffer */
export function buildFlightRouteSchema(data: RouteSchemaData) {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Vuelos de ${data.originCity} a ${data.destinationCity}`,
    description: `Vuelos desde ${data.originCity} (${data.originCode}) a ${data.destinationCity} (${data.destinationCode}). Aerolíneas: ${data.airlines.join(', ')}.`,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: data.lowPrice,
      ...(data.highPrice ? { highPrice: data.highPrice } : {}),
      offerCount: data.airlines.length,
      url: base,
    },
  };
}

/** AutoRental with AggregateOffer */
export function buildAutoRentalSchema(data: AutoRentalSchemaData) {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    ...(data.image ? { image: data.image } : {}),
    brand: { '@type': 'Brand', name: data.provider },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: data.lowPrice,
      ...(data.highPrice ? { highPrice: data.highPrice } : {}),
      availability: 'https://schema.org/InStock',
      url: `${base}/cars`,
      areaServed: { '@type': 'Country', name: data.areaServed },
    },
  };
}

/** Article — for guide/blog pages */
export function buildArticleSchema(data: ArticleSchemaData) {
  const base = getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.description,
    ...(data.image ? { image: data.image } : {}),
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${base}/brand/logo.png` },
    },
    mainEntityOfPage: `${base}${data.path}`,
  };
}

/** HowTo — for step-by-step guides */
export function buildHowToSchema({
  name,
  description,
  steps,
}: {
  name: string;
  description: string;
  steps: HowToStep[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}
