/**
 * @fileoverview Flight search results page — reads URL search params,
 *               fetches matching flights and renders FlightResultsList.
 * @module app/(public)/flights/search/page
 */
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import FlightResultsList from '@/components/features/flights/FlightResultsList';
import { useFlightSearch } from '@/hooks/useFlightSearch';

export default function FlightSearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { results, isLoading, search } = useFlightSearch();
  const passengerCount = Number(searchParams.get('passengers')) || 1;

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const departure = searchParams.get('departure');
    const passengers = searchParams.get('passengers');

    if (from && to && departure) {
      search({
        origin: from,
        destination: to,
        departure_date: departure,
        return_date: searchParams.get('return') ?? undefined,
        passengers: Number(passengers) || 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Map FlightWithDetails → FlightCardProps with checkout navigation
  const cards = results.map((f) => ({
    id: f.id,
    airline: f.airline?.name ?? 'Aerolínea',
    flightCode: f.flight_number,
    originCode: f.origin_airport?.iata_code ?? '',
    destinationCode: f.destination_airport?.iata_code ?? '',
    departureTime: new Date(f.departure_datetime).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    arrivalTime: new Date(f.arrival_datetime).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    duration: `${Math.round(
      (new Date(f.arrival_datetime).getTime() -
        new Date(f.departure_datetime).getTime()) /
        3_600_000,
    )}h`,
    stops: 0,
    price: f.final_price,
    availableSeats: f.available_seats,
    onSelect: () => router.push(`/checkout?flight=${f.id}&passengers=${passengerCount}`),
  }));

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-12">
          <div className="mx-auto max-w-5xl px-6">
            <FlightSearchForm />
          </div>
        </section>

        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-5xl px-6">
            <FlightResultsList flights={cards} isLoading={isLoading} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
