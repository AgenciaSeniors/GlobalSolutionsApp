'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import FlightResultsList from '@/components/features/flights/FlightResultsList';
import { useFlightSearch } from '@/hooks/useFlightSearch';
import type { FlightOffer } from '@/types/models';

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

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

  const flights: FlightOffer[] = useMemo(() => {
    return results.map((f) => {
      const departureMs = new Date(f.departure_datetime).getTime();
      const arrivalMs = new Date(f.arrival_datetime).getTime();
      const durationMs = arrivalMs - departureMs;

      const duration = formatDuration(durationMs);

      return {
        id: f.id,
        price: f.final_price,

        // FlightWithDetails no trae currency/type en tu models.ts:
        currency: 'USD',
        type: 'oneway',

        totalDuration: duration,

        segments: [
          {
            id: `${f.id}-seg-1`,
            origin: f.origin_airport.iata_code,
            destination: f.destination_airport.iata_code,
            departureTime: f.departure_datetime,
            arrivalTime: f.arrival_datetime,
            flightNumber: f.flight_number,
            duration,

            // FlightSegment.airline es UiAirline (id, name, code, logoUrl?)
            airline: {
              id: f.airline.id,
              name: f.airline.name,
              code: f.airline.iata_code,
              logoUrl: f.airline.logo_url ?? undefined,
            },
          },
        ],
      };
    });
  }, [results]);

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
              flights={flights}
              isLoading={isLoading}
              onSelectFlight={(flightId) =>
                router.push(`/checkout?flight=${flightId}&passengers=${passengerCount}`)
              }
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
