'use client';

/**
 * @fileoverview Flights page — search form + results on same page (scroll).
 * @module app/(public)/flights/page
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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

type SearchPayload = {
  from: string;
  to: string;
  departure: string;
  passengers: string;
  cabinClass?: string;
  return?: string;
};

export default function FlightsPage() {
  const router = useRouter();

  const { results, isLoading, error, search, clearCache } = useFlightSearch();

  const [lastSearch, setLastSearch] = useState<SearchPayload | null>(null);

  // Re-lanzar búsqueda si el componente remonta (StrictMode dev double-mount)
  // con lastSearch pendiente y sin resultados ni carga activa.
  useEffect(() => {
    const params = lastSearchRef.current;
    if (!params || isLoadingRef.current || resultsRef.current.length > 0) return;
    runSearch(params, activeLegRef.current);
  // Intencionalmente [] — solo queremos que corra en el mount, no en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tabs (ida / regreso)
  const [activeLeg, setActiveLeg] = useState(0);

  // Filtros (sidebar) — max: 0 significa sin límite superior
  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    priceRange: { min: 0, max: 0 },
    airlines: [],
  });

  // Map to keep raw results indexed by their mapped ID for sessionStorage
  const rawResultsMapRef = useRef<Map<string, unknown>>(new Map());

  // Ref mirrors for use inside effects without adding them as deps
  const lastSearchRef = useRef<SearchPayload | null>(null);
  const activeLegRef = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);
  const resultsRef = useRef<typeof results>([]);
  lastSearchRef.current = lastSearch;
  activeLegRef.current = activeLeg;
  isLoadingRef.current = isLoading;
  resultsRef.current = results;

  // Construye legs para los tabs Ida/Regreso
  const legs = useMemo(() => {
    if (!lastSearch) return [];
    const base = [{ origin: lastSearch.from, destination: lastSearch.to, date: lastSearch.departure }];
    if (lastSearch.return) {
      base.push({
        origin: lastSearch.to,
        destination: lastSearch.from,
        date: lastSearch.return,
      });
    }
    return base.filter((l) => l.origin && l.destination && l.date);
  }, [lastSearch]);

  // Helper: ejecuta la búsqueda para un leg dado
  function runSearch(params: SearchPayload, leg: number) {
    const passengersCount = Number(params.passengers) || 1;

    if (leg === 0) {
      search({
        origin: params.from,
        destination: params.to,
        departure_date: params.departure,
        passengers: passengersCount,
        cabinClass: params.cabinClass ?? 'economy',
      });
    } else if (leg === 1 && params.return) {
      search({
        origin: params.to,
        destination: params.from,
        departure_date: params.return,
        passengers: passengersCount,
        cabinClass: params.cabinClass ?? 'economy',
      });
    }
  }

  // Map results -> FlightOffer para la UI usando el mapper
  const flights: FlightOffer[] = useMemo(() => {
    const rawArr = results ?? [];
    const mapped = rawArr.map((f) => mapApiFlightToOffer(f));

    // Build a map: mappedId -> raw result data
    const newMap = new Map<string, unknown>();
    for (let i = 0; i < mapped.length; i++) {
      const raw = rawArr[i];
      if (raw) newMap.set(mapped[i].id, raw);
    }
    rawResultsMapRef.current = newMap;

    return mapped;
  }, [results]);

  // Lista dinámica de aerolíneas presentes en los resultados actuales
  const availableAirlines = useMemo(() => {
    const names = new Set<string>();
    for (const f of flights) {
      const name = f.segments?.[0]?.airline?.name;
      if (name && name !== 'Aerolínea') names.add(name);
    }
    return Array.from(names).sort();
  }, [flights]);

  // Aplicar filtros — max: 0 significa sin límite superior
  const filteredFlights = useMemo(() => {
    const result = flights.filter((flight) => {
      // Precio
      const minPrice = filters.priceRange.min ?? 0;
      const maxPrice = filters.priceRange.max;
      if (flight.price < minPrice) return false;
      if (maxPrice > 0 && flight.price > maxPrice) return false;

      // Aerolíneas
      if (filters.airlines.length > 0) {
        const airlineCode = flight.airline_code ?? '';
        const airlineName = flight.segments?.[0]?.airline?.name ?? '';
        if (!filters.airlines.includes(airlineName) && !filters.airlines.includes(airlineCode)) return false;
      }

      // Escalas
      if (filters.stops.length > 0) {
        const stopsCount = Math.max(0, (flight.segments?.length ?? 1) - 1);
        const ok =
          (filters.stops.includes('direct') && stopsCount === 0) ||
          (filters.stops.includes('1stop') && stopsCount === 1) ||
          (filters.stops.includes('2stops') && stopsCount >= 2);
        if (!ok) return false;
      }

      return true;
    });
    return result;
  }, [flights, filters]);

  // Handler principal: llamado por FlightSearchForm
  const handleSearch = (params: SearchPayload) => {
    clearCache();
    setLastSearch(params);
    setActiveLeg(0);
    // Disparar búsqueda directamente (sin useEffect para evitar timing issues en StrictMode)
    runSearch(params, 0);

    setTimeout(() => {
      document.getElementById('flight-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  // Handler para cambio de tab (ida / regreso)
  const handleLegChange = (leg: number) => {
    setActiveLeg(leg);
    if (lastSearch) {
      clearCache();
      runSearch(lastSearch, leg);
    }
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

            {/* Importante: NO navegar, solo disparar búsqueda */}
            <FlightSearchForm onSearch={handleSearch} autoSubmitOnClassChange />
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
              <FlightLegTabs legs={legs} activeLeg={activeLeg} onLegChange={handleLegChange} />
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <FlightFilters
                  onFilterChange={setFilters}
                  availableAirlines={availableAirlines}
                />
              </div>

              <div className="lg:col-span-8">
                <FlightResultsList
                  flights={filteredFlights}
                  isLoading={isLoading}
                  error={error}
                  onRetry={() => lastSearch && handleSearch(lastSearch)}
                  onSelectFlight={(flightId) => {
                    const passengersCount = Number(lastSearch?.passengers) || 1;

                    try {
                      const rawFlight = rawResultsMapRef.current.get(flightId);
                      if (rawFlight) {
                        sessionStorage.setItem(
                          'selectedFlightData',
                          JSON.stringify(rawFlight)
                        );
                      }
                    } catch (e) {
                      console.warn('[Flights] Could not save to sessionStorage:', e);
                    }

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
