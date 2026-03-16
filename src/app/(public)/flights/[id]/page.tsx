/**
 * @fileoverview Flight detail page — server component with SEO metadata.
 * Fetches flight data server-side for proper SSR / metadata generation.
 * Interactive booking logic is delegated to FlightDetailClient.
 * @module app/(public)/flights/[id]/page
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import JsonLd from '@/components/seo/JsonLd';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { buildFlightRouteSchema, buildProductReviewProps } from '@/lib/seo/jsonld';
import { getReviewStats } from '@/lib/seo/review-stats';
import { createClient } from '@/lib/supabase/server';
import type { FlightWithDetails } from '@/types/models';
import FlightDetailClient from './FlightDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

/** Server-side fetch for flight data with joined relations. */
async function getFlightById(id: string): Promise<FlightWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('flights')
    .select(
      '*, airline:airlines(*), origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)'
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as unknown as FlightWithDetails;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const flight = await getFlightById(id);

  if (!flight) {
    return { title: 'Vuelo no encontrado' };
  }

  const origin = flight.origin_airport;
  const destination = flight.destination_airport;
  const price = flight.final_price.toFixed(2);

  const title = `Vuelo ${origin.city} \u2192 ${destination.city} desde $${price}`;
  const description = `Vuelo ${flight.airline.name} de ${origin.city} (${origin.iata_code}) a ${destination.city} (${destination.iata_code}). Desde $${price}/persona. Reserva con Zelle, PIX o SPEI.`;

  return {
    title,
    description,
    alternates: { canonical: `/flights/${id}` },
    openGraph: {
      title,
      description,
      url: `/flights/${id}`,
    },
  };
}

export default async function FlightDetailPage({ params }: Props) {
  const { id } = await params;
  const flight = await getFlightById(id);

  if (!flight) {
    notFound();
  }

  const origin = flight.origin_airport;
  const destination = flight.destination_airport;

  // Build JSON-LD structured data with review ratings
  const reviewStats = await getReviewStats();
  const flightSchema = {
    ...buildFlightRouteSchema({
      originCity: origin.city,
      originCode: origin.iata_code,
      destinationCity: destination.city,
      destinationCode: destination.iata_code,
      lowPrice: flight.final_price,
      airlines: [flight.airline.name],
    }),
    ...buildProductReviewProps(reviewStats),
  };

  // Breadcrumb items
  const breadcrumbs = [
    { name: 'Inicio', href: '/' },
    { name: 'Vuelos', href: '/flights' },
    { name: `Vuelo ${origin.iata_code}\u2192${destination.iata_code}`, href: `/flights/${id}` },
  ];

  return (
    <>
      <JsonLd data={flightSchema} />
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px] pb-20">
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <Breadcrumbs items={breadcrumbs} className="mb-4" />
        </div>
        <FlightDetailClient flight={flight} />
      </main>
      <Footer />
    </>
  );
}
