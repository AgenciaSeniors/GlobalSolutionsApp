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

// Copiamos el tipo local que usa FlightFilters
type FilterState = {
  stops: string[];
  priceRange: { min: number; max: number };
  airlines: string[];
};

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

  // ✅ Mapeo a FlightOffer para UI usando el mapper (soporta segmentos reales si viene raw)
  const flights: FlightOffer[] = useMemo(() => {
    useEffect(() => {
  const first = results?.[0];
  if (!first) return;

  console.log("FIRST RESULT KEYS:", Object.keys(first));
  console.log("raw exists?", Boolean((first as any).raw));
  console.log("raw segments len:", (first as any)?.raw?.slices?.[0]?.segments?.length);
  console.log("stops exists?", Array.isArray((first as any).stops), "len:", (first as any)?.stops?.length);
}, [results]);

    return results.map(mapApiFlightToOffer);
  }, [results]);

  // ✅ Por ahora no aplicamos filtros (evita romper). Luego lo conectamos con `filters`.
  const filteredFlights = flights;

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        {/* Form arriba */}
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
