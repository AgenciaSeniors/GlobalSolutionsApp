import type { FlightWithDetails } from '@/types/models';
import type { FlightLeg, FlightSearchParams, FlightSearchFilters } from '@/types/api.types';

type ResultsByLeg = Array<{ legIndex: number; flights: FlightWithDetails[] }>;

// Helper interface for the legacy search params structure
interface LegacySearchParams {
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  passengers?: number;
  filters?: FlightSearchFilters;
}

function normalizeFilters(filters?: FlightSearchFilters): FlightSearchFilters | undefined {
  if (!filters) return undefined;

  const airlineCodes =
    Array.isArray(filters.airlineCodes) && filters.airlineCodes.length
      ? filters.airlineCodes.map((c) => String(c).toUpperCase()).sort()
      : undefined;

  const minPrice = filters.minPrice != null ? Number(filters.minPrice) : undefined;
  const maxPrice = filters.maxPrice != null ? Number(filters.maxPrice) : undefined;

  const departureTimeRange =
    filters.departureTimeRange?.from && filters.departureTimeRange?.to
      ? { from: String(filters.departureTimeRange.from), to: String(filters.departureTimeRange.to) }
      : undefined;

  const maxStops = filters.maxStops != null ? Number(filters.maxStops) : undefined;

  return { airlineCodes, minPrice, maxPrice, departureTimeRange, maxStops };
}

function buildSearchBody(
  params: FlightSearchParams,
): { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters } {
  // New format already
  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    // We cast to a shape that includes filters to avoid 'any'
    const multiLegParams = params as { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters };
    
    return {
      legs: multiLegParams.legs.map((l) => ({
        origin: l.origin.toUpperCase(),
        destination: l.destination.toUpperCase(),
        departure_date: l.departure_date,
      })),
      passengers: multiLegParams.passengers,
      filters: normalizeFilters(multiLegParams.filters),
    };
  }

  // Legacy format
  // Replaced 'as any' with the specific interface defined above
  const legacy = params as LegacySearchParams;
  
  const origin = String(legacy.origin ?? '').toUpperCase();
  const destination = String(legacy.destination ?? '').toUpperCase();
  const departure_date = String(legacy.departure_date ?? '');
  const passengers = Number(legacy.passengers ?? 1);

  const legs: FlightLeg[] = [{ origin, destination, departure_date }];

  if (legacy.return_date) {
    legs.push({
      origin: destination,
      destination: origin,
      departure_date: String(legacy.return_date),
    });
  }

  return { legs, passengers, filters: normalizeFilters(legacy.filters) };
}

/**
 * Flights Service
 * Todas las búsquedas pasan por el API route (/api/flights/search)
 * para cache, seguridad y normalización.
 */
export const flightsService = {
  /**
   * Buscar vuelos (compatibilidad UI actual): devuelve SOLO el tramo 0
   */
  async search(params: FlightSearchParams): Promise<FlightWithDetails[]> {
    const body = buildSearchBody(params);

    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? 'Error buscando vuelos');
    }

    // Backend nuevo: results por leg
    if (Array.isArray(json?.results) && json.results.length && json.results[0]?.flights) {
      return (json.results[0].flights ?? []) as FlightWithDetails[];
    }

    // Fallback (por si un entorno devuelve array plano)
    return (json.results ?? []) as FlightWithDetails[];
  },

  /**
   * Buscar itinerario multi-leg (para UI multi-tramo)
   */
  async searchItinerary(params: FlightSearchParams): Promise<ResultsByLeg> {
    const body = buildSearchBody(params);

    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? 'Error buscando vuelos');
    }

    return (json.results ?? []) as ResultsByLeg;
  },

  async getExclusiveOffers(): Promise<FlightWithDetails[]> {
    const res = await fetch('/api/flights/exclusive');
    const json = await res.json();

    if (!res.ok) throw new Error(json?.error ?? 'Error cargando ofertas');
    return (json.results ?? []) as FlightWithDetails[];
  },

  async getById(id: string): Promise<FlightWithDetails | null> {
    const res = await fetch(`/api/flights/${id}`);
    const json = await res.json();

    if (!res.ok) throw new Error(json?.error ?? 'Error cargando vuelo');
    return (json.data ?? null) as FlightWithDetails | null;
  },
};