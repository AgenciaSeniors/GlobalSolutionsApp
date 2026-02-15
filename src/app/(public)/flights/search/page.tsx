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

// Copiamos el tipo local que usa FlightFilters
type FilterState = {
  stops: string[];
  priceRange: { min: number; max: number };
  airlines: string[];
};

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

  const { results, isLoading, error, search } = useFlightSearch();

  const passengerCount = Number(searchParams.get('passengers')) || 1;

  // Tabs (ida / regreso)
  const [activeLeg, setActiveLeg] = useState(0);

  // Filtros (sidebar)
  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    priceRange: { min: 0, max: 2000 },
    airlines: [],
  });

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const departure = searchParams.get('departure') || '';
  const returnDate = searchParams.get('return') || '';

  // Legs para tabs
  const legs = useMemo(() => {
    const base = [{ origin: from, destination: to, date: departure }];
    if (returnDate) base.push({ origin: to, destination: from, date: returnDate });
    return base.filter((l) => l.origin && l.destination && l.date);
  }, [from, to, departure, returnDate]);

  // Dispara búsqueda según tab activa
  useEffect(() => {
    // Si no hay params mínimos, no buscamos
    if (!from || !to || !departure) return;

    // Ida
    if (activeLeg === 0) {
      search({
        origin: from,
        destination: to,
        departure_date: departure,
        passengers: passengerCount,
      });
      return;
    }

    // Regreso (solo si existe returnDate)
    if (activeLeg === 1 && returnDate) {
      search({
        origin: to,
        destination: from,
        departure_date: returnDate,
        passengers: passengerCount,
      });
    }
  }, [activeLeg, from, to, departure, returnDate, passengerCount, search]);

  // Map a FlightOffer para UI cards (defensivo para evitar null/undefined)
  const flights: FlightOffer[] = useMemo(() => {
    return results.map((f) => {
      const departureMs = new Date(f.departure_datetime).getTime();
      const arrivalMs = new Date(f.arrival_datetime).getTime();
      const durationMs = arrivalMs - departureMs;

      const duration = formatDuration(durationMs);

      return {
        id: f.id,
        price: f.final_price,
        currency: 'USD',
        type: 'oneway',
        totalDuration: duration,
        segments: [
          {
            id: `${f.id}-seg-1`,
            origin: f.origin_airport?.iata_code ?? '',
            destination: f.destination_airport?.iata_code ?? '',
            departureTime: f.departure_datetime,
            arrivalTime: f.arrival_datetime,
            flightNumber: f.flight_number,
            duration,
            airline: {
              id: f.airline?.id ?? f.airline_id,
              name: f.airline?.name ?? 'Aerolínea',
              code: f.airline?.iata_code ?? '',
              logoUrl: f.airline?.logo_url ?? 
         (f.airline?.iata_code ? 
           `https://www.gstatic.com/flights/airline_logos/70px/${f.airline.iata_code}.png` 
           : undefined)
            },
          },
        ],
      };
    });
  }, [results]);

  // Aplicar filtros locales (UI)
  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      // Precio
      const minOk = flight.price >= (filters.priceRange.min ?? 0);
      const maxOk = flight.price <= (filters.priceRange.max ?? 999999);
      if (!minOk || !maxOk) return false;

      // Aerolíneas (si seleccionó alguna)
      if (filters.airlines.length > 0) {
        const airlineName = flight.segments?.[0]?.airline?.name ?? '';
        if (!filters.airlines.includes(airlineName)) return false;
      }

      // Escalas (con FlightOffer actual normalmente es 1 segmento = directo)
      // Si mañana agregan más segmentos, esto seguirá funcionando.
      if (filters.stops.length > 0) {
        const segmentsCount = flight.segments?.length ?? 1;
        const stopsCount = Math.max(0, segmentsCount - 1);

        const isDirect = stopsCount === 0;
        const is1Stop = stopsCount === 1;
        const is2Plus = stopsCount >= 2;

        const ok =
          (filters.stops.includes('direct') && isDirect) ||
          (filters.stops.includes('1stop') && is1Stop) ||
          (filters.stops.includes('2stops') && is2Plus);

        if (!ok) return false;
      }

      return true;
    });
  }, [flights, filters]);

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        {/* Form arriba (se queda como está) */}
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <FlightSearchForm />
          </div>
        </section>

        {/* Resultados */}
        <section className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-6 text-3xl font-extrabold text-[#0F2545]">
              Resultados de Búsqueda
            </h2>

            {/* Tabs Ida/Regreso */}
            {legs.length > 0 && (
              <FlightLegTabs legs={legs} activeLeg={activeLeg} onLegChange={setActiveLeg} />
            )}

            {/* Layout: filtros izquierda + lista derecha */}
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
