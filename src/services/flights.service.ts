//src\services\flights.service.ts
import type { FlightWithDetails } from '@/types/models';
import type { FlightLeg, FlightSearchParams, FlightSearchFilters } from '@/types/api.types';

/**
 * Flights Service — Client-side service layer for the two-phase search API (C1.1).
 *
 * v2 — Improvements:
 *   1. Stronger type safety on responses
 *   2. Configurable polling interval (default 1.5s to reduce server load)
 *   3. Explicit abort error detection
 *   4. Better error messages
 */

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

interface LegacySearchParams {
  origin?: string;
  destination?: string;
  departure_date?: string;
  return_date?: string;
  passengers?: number;
  filters?: FlightSearchFilters;
}

/* -------------------------------------------------- */
/* ---- NORMALIZATION ------------------------------- */
/* -------------------------------------------------- */

function normalizeFilters(
  filters?: FlightSearchFilters
): FlightSearchFilters | undefined {
  if (!filters) return undefined;

  const airlineCodes =
    Array.isArray(filters.airlineCodes) && filters.airlineCodes.length
      ? filters.airlineCodes.map((c) => String(c).toUpperCase()).sort()
      : undefined;

  const minPrice =
    filters.minPrice != null ? Number(filters.minPrice) : undefined;
  const maxPrice =
    filters.maxPrice != null ? Number(filters.maxPrice) : undefined;

  const departureTimeRange =
    filters.departureTimeRange?.from && filters.departureTimeRange?.to
      ? {
          from: String(filters.departureTimeRange.from),
          to: String(filters.departureTimeRange.to),
        }
      : undefined;

  const maxStops =
    filters.maxStops != null ? Number(filters.maxStops) : undefined;

  return { airlineCodes, minPrice, maxPrice, departureTimeRange, maxStops };
}

function buildSearchBody(params: FlightSearchParams): {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
} {
  // New format
  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    const multiLegParams = params as {
      legs: FlightLeg[];
      passengers: number;
      filters?: FlightSearchFilters;
    };

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

/* -------------------------------------------------- */
/* ---- ERROR HELPERS ------------------------------- */
/* -------------------------------------------------- */

function extractErrorMessage(json: unknown): string {
  if (typeof json === 'object' && json !== null && 'error' in json) {
    return String((json as { error?: string }).error ?? 'Error buscando vuelos');
  }
  return 'Error buscando vuelos';
}

/* -------------------------------------------------- */
/* ---- SERVICE ------------------------------------- */
/* -------------------------------------------------- */

export const flightsService = {
  /**
   * C1.1: Start a search session.
   * Returns immediately with cached results if available, or a pending session ID.
   */
  async startSearchSession(
    params: FlightSearchParams,
    opts?: { signal?: AbortSignal }
  ): Promise<SearchSessionResponse> {
    const body = buildSearchBody(params);
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (opts?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts?.signal,
      });

      // Retry on 405/503 (dev server compiling) — only once
      if ((res.status === 405 || res.status === 503) && attempt < maxAttempts) {
        console.warn(
          `[flights.service] POST /api/flights/search returned ${res.status}, retrying in 1s...`
        );
        await sleep(1000, opts?.signal);
        continue;
      }

      let json: SearchSessionResponse;
      try {
        json = (await res.json()) as SearchSessionResponse;
      } catch {
        throw new Error(
          `Error del servidor (${res.status}). Intente de nuevo.`
        );
      }

      if (!res.ok) {
        throw new Error(extractErrorMessage(json));
      }

      return json;
    }

    // Should never reach here, but just in case
    throw new Error('Error inesperado al iniciar búsqueda.');
  },

  /**
   * C1.1: Get the current state of a search session.
   */
  async getSearchSession(
    sessionId: string,
    opts?: { signal?: AbortSignal }
  ): Promise<SearchSessionResponse> {
    const res = await fetch(
      `/api/flights/search/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        signal: opts?.signal,
      }
    );

    let json: SearchSessionResponse;
    try {
      json = (await res.json()) as SearchSessionResponse;
    } catch {
      throw new Error(
        `Error del servidor (${res.status}). Intente de nuevo.`
      );
    }

    if (!res.ok) {
      throw new Error(extractErrorMessage(json));
    }

    return json;
  },

  /**
   * C1.1: Poll a session until it completes or fails.
   */
  async pollSearchSession(
    sessionId: string,
    opts?: {
      signal?: AbortSignal;
      maxWaitMs?: number;
      intervalMs?: number;
    }
  ): Promise<SearchSessionResponse> {
    const maxWaitMs = opts?.maxWaitMs ?? 45_000;
    const intervalMs = opts?.intervalMs ?? 1_500;
    const t0 = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const snapshot = await flightsService.getSearchSession(sessionId, {
        signal: opts?.signal,
      });
      const status = snapshot.status;

      if (status === 'complete') return snapshot;
      if (status === 'failed') {
        // If we have stale results, return them with the error
        if (
          Array.isArray(snapshot.results) &&
          snapshot.results.length > 0 &&
          snapshot.results.some((r) => r.flights?.length > 0)
        ) {
          return snapshot;
        }
        throw new Error(snapshot.error ?? 'Error buscando vuelos');
      }

      if (Date.now() - t0 > maxWaitMs) {
        throw new Error(
          'La búsqueda tardó demasiado. Intente nuevamente.'
        );
      }

      await sleep(intervalMs, opts?.signal);
    }
  },

  /**
   * Convenience: search and return flat results for leg 0.
   */
  async search(params: FlightSearchParams): Promise<FlightWithDetails[]> {
    const started = await flightsService.startSearchSession(params);
    const sessionId = started.sessionId;
    if (!sessionId) {
      const r0 =
        Array.isArray(started.results) && started.results[0]?.flights
          ? started.results[0].flights
          : [];
      return (r0 ?? []) as FlightWithDetails[];
    }

    const final =
      started.status === 'complete'
        ? started
        : await flightsService.pollSearchSession(sessionId);
    const r0 =
      Array.isArray(final.results) && final.results[0]?.flights
        ? final.results[0].flights
        : [];
    return (r0 ?? []) as FlightWithDetails[];
  },

  /**
   * Multi-leg search: returns all legs.
   */
  async searchItinerary(
    params: FlightSearchParams
  ): Promise<ResultsByLeg> {
    const started = await flightsService.startSearchSession(params);
    const sessionId = started.sessionId;
    if (!sessionId) return (started.results ?? []) as ResultsByLeg;

    const final =
      started.status === 'complete'
        ? started
        : await flightsService.pollSearchSession(sessionId);
    return (final.results ?? []) as ResultsByLeg;
  },

  async getExclusiveOffers(): Promise<FlightWithDetails[]> {
    const res = await fetch('/api/flights/exclusive');
    const json = await res.json();

    if (!res.ok)
      throw new Error(json?.error ?? 'Error cargando ofertas');
    return (json.results ?? []) as FlightWithDetails[];
  },

  async getById(id: string): Promise<FlightWithDetails | null> {
    const res = await fetch(`/api/flights/${id}`);
    const json = await res.json();

    if (!res.ok)
      throw new Error(json?.error ?? 'Error cargando vuelo');
    return (json.data ?? null) as FlightWithDetails | null;
  },
};

/* -------------------------------------------------- */
/* ---- SLEEP WITH ABORT SUPPORT -------------------- */
/* -------------------------------------------------- */

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(t);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const cleanup = () => {
      try {
        signal?.removeEventListener('abort', onAbort);
      } catch {
        // ignore
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
