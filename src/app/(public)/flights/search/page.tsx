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

  // Map FlightWithDetails → FlightOffer with checkout navigation
  const flightOffers = results.map((f) => ({
    id: f.id,
    price: f.final_price,
    currency: 'USD',
    segments: [{
      id: f.id,
      origin: f.origin_airport?.iata_code ?? '',
      destination: f.destination_airport?.iata_code ?? '',
      departureTime: f.departure_datetime,
      arrivalTime: f.arrival_datetime,
      airline: {
        id: f.airline_id,
        name: f.airline?.name ?? 'Aerolínea',
        code: f.airline?.iata_code ?? '',
      },
      flightNumber: f.flight_number,
      duration: `${Math.round(
        (new Date(f.arrival_datetime).getTime() -
          new Date(f.departure_datetime).getTime()) /
          3_600_000,
      )}h`,
    }],
    totalDuration: `${Math.round(
      (new Date(f.arrival_datetime).getTime() -
        new Date(f.departure_datetime).getTime()) /
        3_600_000,
    )}h`,
    type: 'oneway' as const,
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
            <FlightResultsList 
              flights={flightOffers} 
              isLoading={isLoading} 
              onSelectFlight={(flightId) => router.push(`/checkout?flight=${flightId}&passengers=${passengerCount}`)}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
