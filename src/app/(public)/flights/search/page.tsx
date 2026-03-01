//C:\Users\Eduardo\GlobalSolutionsApp\src\app\(public)\flights\search
'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FlightSearchForm from '@/components/forms/FlightSearchForm';

import FlightLegTabs from '@/components/features/flights/FlightLegTabs';
import FlightFilters from '@/components/features/flights/FlightFilters';
import FlightResultsList from '@/components/features/flights/FlightResultsList';
import MulticityItinerarySummary from '@/components/features/flights/MulticityItinerarySummary';

import { useFlightSearch } from '@/hooks/useFlightSearch';
import { useMulticitySelection } from '@/hooks/useMulticitySelection';
import type { FlightOffer } from '@/types/models';
import { mapApiFlightToOffer } from '@/lib/flights/flightOffer.mapper';

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

function FlightSearchResultsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { results, resultsByLeg, isLoading, error, search, hasMore, loadMore } = useFlightSearch();

  const passengerCount = Number(searchParams.get('passengers')) || 1;

  const [activeLeg, setActiveLeg] = useState<number>(0);

  const [filters, setFilters] = useState<FilterState>({
    stops: [],
    priceRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
    airlines: [],
  });

  // Keep a raw->mapped index so we can persist the selected flight
  const rawResultsMapRef = useRef<Map<string, unknown>>(new Map());
  const resultsRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const departure = searchParams.get('departure') || '';
  const returnDate = searchParams.get('return') || '';
  const cabinClass = searchParams.get('cabinClass') || 'economy';
  const tripTypeParam = searchParams.get('tripType') || '';
  const legsParam = searchParams.get('legs') || '';
  const isMulticity = tripTypeParam === 'multicity' && legsParam.length > 0;

  // Parse multicity legs from URL (used by both formInitialValues and legs memo)
  const parsedLegs = useMemo(() => {
    if (!isMulticity || !legsParam) return [];
    return legsParam.split(',').map((segment) => {
      const parts = segment.split('-');
      return {
        origin: parts[0] || '',
        destination: parts[1] || '',
        date: parts.slice(2).join('-'), // rejoin YYYY-MM-DD
      };
    }).filter((l) => l.origin && l.destination && l.date);
  }, [isMulticity, legsParam]);

  const legs = useMemo(() => {
    if (isMulticity && parsedLegs.length > 0) return parsedLegs;

    // Legacy: roundtrip / oneway
    const base = [{ origin: from, destination: to, date: departure }];
    if (returnDate) base.push({ origin: to, destination: from, date: returnDate });
    return base.filter((l) => l.origin && l.destination && l.date);
  }, [isMulticity, parsedLegs, from, to, departure, returnDate]);

  // Multicity selection state — uses legs.length as totalLegs
  const {
    selectedLegs,
    selectLeg,
    clearLeg,
    clearSelection,
  } = useMulticitySelection(isMulticity ? legs.length : 0);

  // BUG 5 FIX: Clear selection only when legsParam *changes* after initial mount.
  // Using a ref to skip the first render and avoid clearing sessionStorage on unmount
  // (which would wipe the data that checkout needs to read).
  const legsParamPrevRef = useRef<string | null>(null);
  useEffect(() => {
    if (legsParamPrevRef.current === null) {
      // First render — just record the initial value, don't clear
      legsParamPrevRef.current = legsParam;
      return;
    }
    if (legsParamPrevRef.current !== legsParam) {
      // legsParam actually changed (new search) — clear selection
      legsParamPrevRef.current = legsParam;
      if (isMulticity) clearSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legsParam]);

  // Scroll to results when first batch loads
  useEffect(() => {
    if (!isLoading && results.length > 0 && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    if (isLoading) {
      hasScrolledRef.current = false;
    }
  }, [isLoading, results.length]);

  // Pre-fill the search form with URL params
  const formInitialValues = useMemo(
    () => ({
      origin: from,
      destination: to,
      departure,
      returnDate,
      passengers: String(passengerCount),
      cabinClass,
      ...(isMulticity ? { tripType: 'multicity' as const, legs: parsedLegs } : {}),
    }),
    [from, to, departure, returnDate, passengerCount, cabinClass, isMulticity, parsedLegs]
  );

  /**
   * Trigger search when URL params change.
   * - Multicity: sends ALL legs in one request (tab switch doesn't re-fetch)
   * - Legacy: sends per-leg requests as active tab changes
   */
  useEffect(() => {
    if (!from || !to || !departure) return;

    if (isMulticity && parsedLegs.length > 0) {
      // Send all legs in one multi-leg request
      void search({
        legs: parsedLegs.map((l) => ({
          origin: l.origin,
          destination: l.destination,
          departure_date: l.date,
        })),
        passengers: passengerCount,
        cabinClass,
      });
      return;
    }

    // Legacy: single-leg per active tab
    const origin = activeLeg === 0 ? from : to;
    const destination = activeLeg === 0 ? to : from;
    const date = activeLeg === 0 ? departure : returnDate;

    if (!date) return;

    void search({
      origin,
      destination,
      departure_date: date,
      passengers: passengerCount,
      cabinClass,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulticity, activeLeg, from, to, departure, returnDate, parsedLegs, passengerCount, cabinClass, search]);

  const tripTypeForMapper = isMulticity ? 'multicity' as const : (returnDate ? 'roundtrip' as const : 'oneway' as const);

  const flights: FlightOffer[] = useMemo(() => {
    let rawArr: unknown[];

    if (isMulticity && resultsByLeg.length > 0) {
      // Find flights for the active leg from the multi-leg response
      const legData = resultsByLeg.find((r) => r.legIndex === activeLeg);
      rawArr = legData?.flights ?? [];
    } else {
      rawArr = Array.isArray(results) ? results : [];
    }

    const mapped = rawArr.map((f) => mapApiFlightToOffer(f, { tripType: tripTypeForMapper }));

    const newMap = new Map<string, unknown>();
    for (let i = 0; i < mapped.length; i++) {
      const raw = rawArr[i];
      if (raw) newMap.set(mapped[i].id, raw);
    }
    rawResultsMapRef.current = newMap;

    return mapped;
  }, [isMulticity, resultsByLeg, activeLeg, results, tripTypeForMapper]);

  // Build the list of airlines available in the current results (by name, for display + filtering)
  const availableAirlines = useMemo(() => {
    const seen = new Set<string>();
    for (const f of flights) {
      const name = f.segments[0]?.airline?.name || f.airline_code || '';
      if (name) seen.add(name);
    }
    return Array.from(seen).sort();
  }, [flights]);

  // Apply client-side filters
  const filteredFlights: FlightOffer[] = useMemo(() => {
    const min = Number(filters.priceRange.min ?? 0);
    const max = Number(filters.priceRange.max ?? Number.MAX_SAFE_INTEGER);
    const allowedAirlines = new Set(filters.airlines);
    const maxStops = toStopsCountFilter(filters.stops);

    return flights.filter((f) => {
      const priceOk = typeof f.price === 'number' ? f.price >= min && f.price <= max : true;

      // Match by airline name (same value shown in filter checkboxes)
      const airlineName = f.segments[0]?.airline?.name || f.airline_code || '';
      const airlineOk = allowedAirlines.size ? allowedAirlines.has(airlineName) : true;

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

  /** Handles selecting a flight in multicity mode: saves to state and advances to next unselected leg */
  const handleMulticitySelect = (flightId: string) => {
    const raw = rawResultsMapRef.current.get(flightId);
    if (!raw) return;
    const rawObj = raw as Record<string, unknown>;
    const airlineObj = (rawObj.airline ?? {}) as Record<string, unknown>;

    // BUG 1 FIX: capture already-selected indices BEFORE calling selectLeg,
    // because setSelectedLegs is async — reading selectedLegs after selectLeg
    // returns still gives the OLD array (stale state).
    const alreadySelected = new Set(selectedLegs.map((s) => s.legIndex));
    alreadySelected.add(activeLeg); // include the leg we are selecting right now

    selectLeg(
      activeLeg,
      raw,
      {
        price: Number(rawObj.final_price ?? rawObj.price ?? 0),
        airline: String(airlineObj.name ?? rawObj.airline_name ?? ''),
        flightNumber: String(rawObj.flight_number ?? ''),
      },
      legs[activeLeg] ?? { origin: '', destination: '', date: '' },
    );

    // Auto-advance to the next unselected leg using pre-computed set (no stale reads)
    for (let i = 0; i < legs.length; i++) {
      if (!alreadySelected.has(i)) {
        setActiveLeg(i);
        break;
      }
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-6">
            <FlightSearchForm initialValues={formInitialValues} autoSubmitOnClassChange />
          </div>
        </section>

        <section ref={resultsRef} className="bg-neutral-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-4 text-2xl font-extrabold text-[#0F2545] sm:mb-6 sm:text-3xl">Resultados de Búsqueda</h2>

            {legs.length > 0 && (
              <FlightLegTabs
                legs={legs}
                activeLeg={activeLeg}
                onLegChange={setActiveLeg}
                tripType={isMulticity ? 'multicity' : (returnDate ? 'roundtrip' : 'oneway')}
                selectedLegs={isMulticity ? selectedLegs.map((s) => s.legIndex) : undefined}
              />
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-12">
              <div className="md:col-span-1 lg:col-span-4">
                <FlightFilters onFilterChange={setFilters} availableAirlines={availableAirlines} />
              </div>

              <div className="md:col-span-3 lg:col-span-8">
                <FlightResultsList
                  flights={filteredFlights}
                  isLoading={isLoading}
                  error={error}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onSelectFlight={async (flightId) => {
                    // ── Multicity: confirm leg, stay on page ──────────────────
                    if (isMulticity) {
                      handleMulticitySelect(flightId);
                      return;
                    }

                    // ── Legacy (oneway / roundtrip): navigate to checkout ─────
                    try {
                      const rawFlight = rawResultsMapRef.current.get(flightId);
                      if (rawFlight) {
                        sessionStorage.setItem('selectedFlightData', JSON.stringify(rawFlight));
                      }
                    } catch (e) {
                      console.warn('[flights/search] Could not save to sessionStorage:', e);
                    }

                    // Try to persist to get a UUID for the detail page.
                    // If it fails, still navigate with the raw ID — checkout will handle persist.
                    try {
                      const raw = rawResultsMapRef.current.get(flightId);
                      if (raw) {
                        const res = await fetch('/api/flights/persist', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ flight: raw }),
                        });
                        const json = (await res.json()) as { id?: string };
                        if (res.ok && json?.id) {
                          router.push(`/flights/${json.id}?passengers=${passengerCount}`);
                          return;
                        }
                      }
                    } catch (e) {
                      console.warn('[flights/search] persist failed, using raw id:', e);
                    }

                    // Fallback: navigate with raw ID, checkout will persist
                    router.push(`/checkout?flight=${flightId}&passengers=${passengerCount}`);
                  }}
                />

                {/* Multicity summary — shown once at least one leg is selected */}
                {isMulticity && selectedLegs.length > 0 && (
                  <MulticityItinerarySummary
                    selectedLegs={selectedLegs}
                    totalLegs={legs.length}
                    passengerCount={passengerCount}
                    onContinue={() => {
                      router.push(`/checkout?mode=multicity&passengers=${passengerCount}`);
                    }}
                    onClearLeg={(legIndex) => {
                      clearLeg(legIndex);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function FlightSearchResultsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-neutral-500 animate-pulse">Buscando vuelos...</p></div>}>
      <FlightSearchResultsInner />
    </Suspense>
  );
}
