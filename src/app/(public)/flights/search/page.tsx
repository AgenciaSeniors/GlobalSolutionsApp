'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';

import FlightLegTabs from '@/components/features/flights/FlightLegTabs';
import FlightFilters from '@/components/features/flights/FlightFilters';
import FlightResultsList from '@/components/features/flights/FlightResultsList';

import { useFlightSearch } from '@/hooks/useFlightSearch';
import type { FlightOffer } from '@/types/models';
import { mapApiFlightToOffer } from '@/lib/flights/flightOffer.mapper';


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type FilterState = {
  stops: string[];
  priceRange: { min: number; max: number };
  airlines: string[];
};

function toStopsCountFilter(stops: string[]): number | null {
  if (!stops.length) return null;

  const hasDirect = stops.includes('direct');
  const has1 = stops.includes('1stop') || stops.includes('1');
  const has2 = stops.includes('2stops') || stops.includes('2') || stops.includes('2plus');

  if (has2) return 2;
  if (has1) return 1;
  if (hasDirect) return 0;

  return null;
}

export default function FlightSearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { results, isLoading, error, search } = useFlightSearch();

  const passengerCount = Number(searchParams.get('passengers')) || 1;

  const [activeLeg, setActiveLeg] = useState<number>(0);

  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    priceRange: { min: 0, max: 2000 },
    airlines: [],
  });

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const departure = searchParams.get('departure') || '';
  const returnDate = searchParams.get('return') || '';

  // Pre-fill the search form with URL params
  const formInitialValues = useMemo(
    () => ({
      origin: from,
      destination: to,
      departure,
      returnDate,
      passengers: String(passengerCount),
    }),
    [from, to, departure, returnDate, passengerCount]
  );

  const legs = useMemo(() => {
    const base = [{ origin: from, destination: to, date: departure }];
    if (returnDate) base.push({ origin: to, destination: from, date: returnDate });
    return base.filter((l) => l.origin && l.destination && l.date);
  }, [from, to, departure, returnDate]);

  /**
   * Trigger search when URL params change or active leg changes.
   *
   * `search` has a STABLE identity (no state deps in useCallback),
   * so this effect only re-fires when the actual search parameters change —
   * not on every error/loading state transition.
   */
  useEffect(() => {
    if (!from || !to || !departure) return;

    const origin = activeLeg === 0 ? from : to;
    const destination = activeLeg === 0 ? to : from;
    const date = activeLeg === 0 ? departure : returnDate;

    if (!date) return;

    void search({
      origin,
      destination,
      departure_date: date,
      passengers: passengerCount,
    });
  }, [activeLeg, from, to, departure, returnDate, passengerCount, search]);

  const flights: FlightOffer[] = useMemo(() => {
    return Array.isArray(results) ? results.map(mapApiFlightToOffer) : [];
  }, [results]);

  // Apply client-side filters
  const filteredFlights: FlightOffer[] = useMemo(() => {
    const min = Number(filters.priceRange.min ?? 0);
    const max = Number(filters.priceRange.max ?? Number.MAX_SAFE_INTEGER);
    const allowedAirlines = new Set(filters.airlines.map((a) => a.toUpperCase()));
    const maxStops = toStopsCountFilter(filters.stops);

    return flights.filter((f) => {
      const priceOk = typeof f.price === 'number' ? f.price >= min && f.price <= max : true;

      const airlineCode = (f.airline_code ?? '').toUpperCase();
      const airlineOk = allowedAirlines.size ? allowedAirlines.has(airlineCode) : true;

      const stopsCount =
        typeof f.stops_count === 'number'
          ? f.stops_count
          : Array.isArray(f.stops)
            ? f.stops.length
            : 0;

      const stopsOk = maxStops == null ? true : stopsCount <= maxStops;

      return priceOk && airlineOk && stopsOk;
    });
  }, [flights, filters]);

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <FlightSearchForm initialValues={formInitialValues} />
          </div>
        </section>

        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-6 text-3xl font-extrabold text-[#0F2545]">Resultados de Búsqueda</h2>

            {legs.length > 0 && (
              <FlightLegTabs legs={legs} activeLeg={activeLeg} onLegChange={setActiveLeg} />
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <FlightFilters onFilterChange={setFilters} />
              </div>

              <div className="lg:col-span-8">
                <FlightResultsList
                  flights={filteredFlights}
                  isLoading={isLoading}
                  error={error}
                  onSelectFlight={(flightId) =>
                    router.push(`/flights/${flightId}?passengers=${passengerCount}`)
                  }
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}