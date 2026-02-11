'use client';

/**
 * @fileoverview Flights page — search form + results on same page (scroll).
 * @module app/(public)/flights/page
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';

import FlightLegTabs from '@/components/features/flights/FlightLegTabs';
import FlightFilters from '@/components/features/flights/FlightFilters';
import FlightResultsList from '@/components/features/flights/FlightResultsList';

import { useFlightSearch } from '@/hooks/useFlightSearch';
import type { FlightOffer } from '@/types/models';

type FilterState = {
  stops: string[];
  priceRange: { min: number; max: number };
  airlines: string[];
};

type SearchPayload = {
  from: string;
  to: string;
  departure: string;
  passengers: string;
  return?: string;
};

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default function FlightsPage() {
  const router = useRouter();

  const { results, isLoading, error, search } = useFlightSearch();

  const [lastSearch, setLastSearch] = useState<SearchPayload | null>(null);

  // Tabs (ida / regreso)
  const [activeLeg, setActiveLeg] = useState(0);

  // Filtros (sidebar)
  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    priceRange: { min: 0, max: 2000 },
    airlines: [],
  });

  // Construye legs a partir de la última búsqueda
  const legs = useMemo(() => {
    if (!lastSearch) return [];
    const base = [
      { origin: lastSearch.from, destination: lastSearch.to, date: lastSearch.departure },
    ];

    if (lastSearch.return) {
      base.push({
        origin: lastSearch.to,
        destination: lastSearch.from,
        date: lastSearch.return,
      });
    }

    return base.filter((l) => l.origin && l.destination && l.date);
  }, [lastSearch]);

  // Ejecutar búsqueda cuando:
  // - se envía una nueva búsqueda
  // - cambias de tab (ida/regreso)
  useEffect(() => {
    if (!lastSearch) return;
    if (!lastSearch.from || !lastSearch.to || !lastSearch.departure) return;

    const passengersCount = Number(lastSearch.passengers) || 1;

    // Ida
    if (activeLeg === 0) {
      search({
        origin: lastSearch.from,
        destination: lastSearch.to,
        departure_date: lastSearch.departure,
        passengers: passengersCount,
      });
      return;
    }

    // Regreso (si existe)
    if (activeLeg === 1 && lastSearch.return) {
      search({
        origin: lastSearch.to,
        destination: lastSearch.from,
        departure_date: lastSearch.return,
        passengers: passengersCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeg, lastSearch]);

  // Map results -> FlightOffer para la UI
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
            origin: f.origin_airport.iata_code,
            destination: f.destination_airport.iata_code,
            departureTime: f.departure_datetime,
            arrivalTime: f.arrival_datetime,
            flightNumber: f.flight_number,
            duration,
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

  // Aplicar filtros (UI local)
  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      // Precio
      const minOk = flight.price >= (filters.priceRange.min ?? 0);
      const maxOk = flight.price <= (filters.priceRange.max ?? 999999);
      if (!minOk || !maxOk) return false;

      // Aerolíneas
      if (filters.airlines.length > 0) {
        const airlineName = flight.segments?.[0]?.airline?.name ?? '';
        if (!filters.airlines.includes(airlineName)) return false;
      }

      // Escalas (si mañana hay múltiples segmentos, esto funciona)
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

  // Handler: lo llama el FlightSearchForm (sin navegar)
  const handleSearch = (params: SearchPayload) => {
    setLastSearch(params);
    setActiveLeg(0);

    // Scroll suave a resultados
    setTimeout(() => {
      document.getElementById('flight-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        {/* Sección del formulario */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                Búsqueda de Vuelos
              </span>
              <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
                Encuentra tu vuelo ideal
              </h1>
            </div>

            {/* ✅ ahora NO navega: llama handleSearch */}
            <FlightSearchForm onSearch={handleSearch} />
          </div>
        </section>

        {/* Resultados + ancla para el scroll */}
        <section id="flight-results" className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-6 text-3xl font-extrabold text-[#0F2545]">
              Resultados de Búsqueda
            </h2>

            {/* Tabs Ida/Regreso */}
            {legs.length > 0 && (
              <FlightLegTabs
                legs={legs}
                activeLeg={activeLeg}
                onLegChange={setActiveLeg}
              />
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
                  onSelectFlight={(flightId) => {
                    const passengersCount = Number(lastSearch?.passengers) || 1;
                    router.push(`/checkout?flight=${flightId}&passengers=${passengersCount}`);
                  }}
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
