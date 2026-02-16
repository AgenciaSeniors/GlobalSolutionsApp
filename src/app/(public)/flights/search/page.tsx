'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type FilterState = {
  stops: string[];
  priceRange: { min: number; max: number };
  airlines: string[];
};

function toStopsCountFilter(stops: string[]): number | null {
  // stops UI suele mandar: ["direct", "1stop", "2stops"] (según tu componente)
  // aquí hacemos “máximo” permitido:
  // - si incluye "direct" => maxStops = 0
  // - si incluye "1stop" => maxStops = 1
  // - si incluye "2stops" => maxStops = 2
  if (!stops.length) return null;

  const hasDirect = stops.includes('direct');
  const has1 = stops.includes('1stop') || stops.includes('1');
  const has2 = stops.includes('2stops') || stops.includes('2') || stops.includes('2plus');

  // si el usuario marca varios, tomamos el más “permisivo”
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

  const legs = useMemo(() => {
    const base = [{ origin: from, destination: to, date: departure }];
    if (returnDate) base.push({ origin: to, destination: from, date: returnDate });
    return base.filter((l) => l.origin && l.destination && l.date);
  }, [from, to, departure, returnDate]);

  // ✅ anti-loop: si el effect corre varias veces (StrictMode/dev), no spamear
  const lastRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!from || !to || !departure) return;

    const origin = activeLeg === 0 ? from : to;
    const destination = activeLeg === 0 ? to : from;
    const date = activeLeg === 0 ? departure : returnDate;

    // si está en tab regreso pero no hay return, no dispares
    if (!date) return;

    const requestKey = `${origin.toUpperCase()}-${destination.toUpperCase()}-${date}-p${passengerCount}`;

    if (lastRequestKeyRef.current === requestKey) return;
    lastRequestKeyRef.current = requestKey;

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

  // ✅ aplica filtros básicos para que `filters` no quede unused
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
            <FlightSearchForm />
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
                    router.push(`/checkout?flight=${flightId}&passengers=${passengerCount}`)
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
