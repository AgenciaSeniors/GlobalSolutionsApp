/**
 * @fileoverview Offer detail page — server component with SEO metadata.
 * Fetches offer data server-side for generateMetadata + initial render,
 * then delegates interactive UI to <OfferDetailClient>.
 * @module app/(public)/offers/[id]/page
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import JsonLd from '@/components/seo/JsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCanonical, buildOgMeta, SITE_NAME } from '@/lib/seo/metadata';
import type { SpecialOffer } from '@/types/models';
import OfferDetailClient from './OfferDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

/** Fetch a single offer with joined relations using the admin client. */
async function getOffer(id: string): Promise<SpecialOffer | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('special_offers')
    .select(
      '*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)'
    )
    .eq('id', id)
    .single();
  return (data as SpecialOffer | null) ?? null;
}

/* ── Metadata ── */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const offer = await getOffer(id);

  if (!offer) {
    return { title: 'Oferta no encontrada' };
  }

  const destination = offer.destination;
  const price = offer.offer_price;
  const airline = offer.airline?.name ?? 'Aerolinea';
  const savingsPct = Math.round(
    ((offer.original_price - price) / offer.original_price) * 100
  );
  const canonical = buildCanonical(`/offers/${id}`);

  const title = `Oferta ${destination} desde $${price} — ${airline}`;
  const description = `Vuelo a ${destination} desde $${price}. Ahorra ${savingsPct}%. ${airline}. Cupos limitados. Reserva con Zelle, PIX o SPEI.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: buildOgMeta({
      title,
      description,
      url: canonical,
      ...(offer.destination_img
        ? { images: [{ url: offer.destination_img, width: 1200, height: 630 }] }
        : {}),
    }),
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/* ── Page ── */

export default async function OfferDetailPage({ params }: Props) {
  const { id } = await params;
  const offer = await getOffer(id);

  if (!offer) {
    notFound();
  }

  const destination = offer.destination;
  const price = offer.offer_price;
  const airline = offer.airline?.name ?? 'Aerolinea';
  const savingsPct = Math.round(
    ((offer.original_price - price) / offer.original_price) * 100
  );

  /* JSON-LD structured data */
  const offerSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Oferta de vuelo a ${destination}`,
    description: `Vuelo a ${destination} desde $${price}. Ahorra ${savingsPct}%. ${airline}.`,
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(offer.destination_img ? { image: offer.destination_img } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price,
      availability:
        offer.max_seats - offer.sold_seats > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: buildCanonical(`/offers/${id}`),
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };

  /* Breadcrumbs */
  const breadcrumbItems = [
    { name: 'Inicio', href: '/' },
    { name: 'Ofertas', href: '/offers' },
    { name: destination, href: `/offers/${id}` },
  ];

  return (
    <>
      <JsonLd data={offerSchema} />
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <div className="mx-auto max-w-6xl px-6 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <OfferDetailClient offer={offer} />
      </main>
      <Footer />
    </>
  );
}
