import type { FlightWithDetails } from '@/types/models';
import type { FlightLeg, FlightSearchParams, FlightSearchFilters } from '@/types/api.types';

type ResultsByLeg = Array<{ legIndex: number; flights: FlightWithDetails[] }>;

type SessionStatus = 'pending' | 'refreshing' | 'running' | 'complete' | 'failed';

type SearchSessionResponse = {
  sessionId?: string;
  status?: SessionStatus;
  source?: string;
  results?: ResultsByLeg;
  providersUsed?: string[];
  error?: string;
};

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
   * C1.1
   * Inicia una búsqueda y devuelve un sessionId (y resultados cacheados opcionales).
   */
  async startSearchSession(params: FlightSearchParams, opts?: { signal?: AbortSignal }): Promise<SearchSessionResponse> {
    const body = buildSearchBody(params);

    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    const json = (await res.json()) as SearchSessionResponse;
    if (!res.ok) {
      throw new Error((json as unknown as { error?: string })?.error ?? 'Error buscando vuelos');
    }

    return json;
  },

  /**
   * C1.1
   * Obtiene el estado/resultados de una sesión.
   */
  async getSearchSession(sessionId: string, opts?: { signal?: AbortSignal }): Promise<SearchSessionResponse> {
    const res = await fetch(`/api/flights/search/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      signal: opts?.signal,
    });

    const json = (await res.json()) as SearchSessionResponse;
    if (!res.ok) {
      throw new Error((json as unknown as { error?: string })?.error ?? 'Error buscando vuelos');
    }

    return json;
  },

  /**
   * C1.1
   * Polling helper: espera hasta completar (o fallar).
   */
  async pollSearchSession(
    sessionId: string,
    opts?: { signal?: AbortSignal; maxWaitMs?: number; intervalMs?: number }
  ): Promise<SearchSessionResponse> {
    const maxWaitMs = opts?.maxWaitMs ?? 45_000;
    const intervalMs = opts?.intervalMs ?? 1_000;
    const t0 = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const snapshot = await flightsService.getSearchSession(sessionId, { signal: opts?.signal });
      const status = snapshot.status;

      if (status === 'complete') return snapshot;
      if (status === 'failed') {
        throw new Error(snapshot.error ?? 'Error buscando vuelos');
      }

      if (Date.now() - t0 > maxWaitMs) {
        throw new Error('La búsqueda tardó demasiado. Intente nuevamente.');
      }

      await sleep(intervalMs, opts?.signal);
    }
  },

  /**
   * Buscar vuelos (compatibilidad UI actual): devuelve SOLO el tramo 0
   */
  async search(params: FlightSearchParams): Promise<FlightWithDetails[]> {
    const started = await flightsService.startSearchSession(params);
    const sessionId = started.sessionId;
    if (!sessionId) {
      // Legacy fallback (shouldn't happen)
      const r0 = Array.isArray(started.results) && started.results[0]?.flights ? started.results[0].flights : [];
      return (r0 ?? []) as FlightWithDetails[];
    }

    const final = started.status === 'complete' ? started : await flightsService.pollSearchSession(sessionId);
    const r0 = Array.isArray(final.results) && final.results[0]?.flights ? final.results[0].flights : [];
    return (r0 ?? []) as FlightWithDetails[];
  },

  /**
   * Buscar itinerario multi-leg (para UI multi-tramo)
   */
  async searchItinerary(params: FlightSearchParams): Promise<ResultsByLeg> {
    const started = await flightsService.startSearchSession(params);
    const sessionId = started.sessionId;
    if (!sessionId) return (started.results ?? []) as ResultsByLeg;

    const final = started.status === 'complete' ? started : await flightsService.pollSearchSession(sessionId);
    return (final.results ?? []) as ResultsByLeg;
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
      // Cleanup listener once resolved
      const cleanup = () => {
        try {
          signal.removeEventListener('abort', onAbort);
        } catch {
          // ignore
        }
      };
      // Resolve cleanup
      setTimeout(cleanup, ms + 5);
    }
  });
}