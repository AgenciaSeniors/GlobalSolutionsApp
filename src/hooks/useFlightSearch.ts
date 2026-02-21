'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

/**
 * useFlightSearch — v5
 *
 * Fixes over v4:
 *   - Added console.log at every state transition for debugging
 *   - pollSearchSession timeout increased to 120s to handle slow SkyScrapper
 *   - Dedup guard now uses a "completed keys" Set so that finished searches
 *     aren't re-triggered by StrictMode remounts or effect re-runs
 */

export type UseFlightSearchResult = {
  results: FlightWithDetails[];
  isLoading: boolean;
  error: string | null;
  search: (params: FlightSearchParams) => Promise<void>;
};

/* ------------------------------------------------------------------ */
/*  Stable request key (dedup)                                        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function stableRequestKey(params: FlightSearchParams): string {
  const p: unknown = params;
  // Extraemos la clase de manera segura (por defecto economy)
  const cClass = isRecord(p) ? String(p.cabinClass ?? 'economy') : 'economy';

  if (isRecord(p) && Array.isArray(p.legs) && p.legs.length > 0) {
    const legsKey = p.legs
      .map((l) => {
        const lr: unknown = l;
        const o = isRecord(lr) ? String(lr.origin ?? '').toUpperCase() : '';
        const d = isRecord(lr) ? String(lr.destination ?? '').toUpperCase() : '';
        const dt = isRecord(lr) ? String(lr.departure_date ?? '') : '';
        return `${o}-${d}-${dt}`;
      })
      .join('|');

    const passengers = isRecord(p) ? Number(p.passengers ?? 1) : 1;
    // Añadimos cClass a la llave para que el hook sepa que es una búsqueda diferente
    return `legs:${legsKey}:p${Number.isFinite(passengers) ? passengers : 1}:c${cClass}`;
  }

  const origin = isRecord(p) ? String(p.origin ?? '').toUpperCase() : '';
  const destination = isRecord(p) ? String(p.destination ?? '').toUpperCase() : '';
  const departure_date = isRecord(p) ? String(p.departure_date ?? '') : '';
  const passengers = isRecord(p) ? Number(p.passengers ?? 1) : 1;

  // Añadimos cClass a la llave aquí también
  return `${origin}-${destination}-${departure_date}-p${Number.isFinite(passengers) ? passengers : 1}:c${cClass}`;
}

/* ------------------------------------------------------------------ */
/*  Extract flights from the API response shape                       */
/* ------------------------------------------------------------------ */

type ResultsByLeg = Array<{ legIndex: number; flights: FlightWithDetails[] }>;

function extractFlights(results: ResultsByLeg | undefined): FlightWithDetails[] {
  if (!Array.isArray(results) || results.length === 0) return [];
  const firstLeg = results[0];
  if (!firstLeg || !Array.isArray(firstLeg.flights)) return [];
  return firstLeg.flights;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useFlightSearch(): UseFlightSearchResult {
  const [results, setResults] = useState<FlightWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs for dedup & abort ──
  const activeKeyRef = useRef<string | null>(null);
  const completedKeysRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // ── Ref mirror of `error` so `search` can read it without being a dep ──
  const errorRef = useRef<string | null>(null);
  errorRef.current = error;

  const search = useCallback(
    async (params: FlightSearchParams): Promise<void> => {
      const key = stableRequestKey(params);

      // Dedup: skip if this key already completed successfully
      if (completedKeysRef.current.has(key) && !errorRef.current) {
        console.log(`[useFlightSearch] SKIP (already completed): ${key}`);
        return;
      }

      // Dedup: skip if same key is currently in-flight
      if (activeKeyRef.current === key && !errorRef.current) {
        console.log(`[useFlightSearch] SKIP (in-flight): ${key}`);
        return;
      }

      // Cancel any previous in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // Set up new request
      activeKeyRef.current = key;
      const controller = new AbortController();
      abortRef.current = controller;

      console.log(`[useFlightSearch] START search: ${key}`);
      setIsLoading(true);
      setError(null);

      try {
        // ── Phase 1: POST to create session ──
        const started = await flightsService.startSearchSession(params, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          console.log(`[useFlightSearch] ABORTED after POST: ${key}`);
          return;
        }

        console.log(
          `[useFlightSearch] POST response: sessionId=${started?.sessionId}, status=${started?.status}`
        );

        const initialFlights = extractFlights(started?.results as ResultsByLeg);
        if (initialFlights.length > 0) {
          setResults(initialFlights);
          console.log(
            `[useFlightSearch] Initial results (from cache): ${initialFlights.length} flights`
          );
        }

        // ── Phase 2: Poll if not complete ──
        const sessionId = started?.sessionId;
        const status = started?.status;

        if (sessionId && status && status !== 'complete') {
          console.log(`[useFlightSearch] Starting poll for session ${sessionId}...`);

          const final = await flightsService.pollSearchSession(sessionId, {
            signal: controller.signal,
            maxWaitMs: 120_000,
            intervalMs: 2_000,
          });

          if (controller.signal.aborted) {
            console.log(`[useFlightSearch] ABORTED during poll: ${key}`);
            return;
          }

          const finalFlights = extractFlights(final?.results as ResultsByLeg);
          console.log(
            `[useFlightSearch] Poll complete: ${finalFlights.length} flights, status=${final?.status}`
          );
          setResults(finalFlights);
        } else if (status === 'complete') {
          console.log(`[useFlightSearch] Session returned complete immediately (cache hit)`);
        }

        // Mark as successfully completed
        completedKeysRef.current.add(key);
        activeKeyRef.current = null;
        setIsLoading(false);

        console.log(`[useFlightSearch] DONE: ${key}`);
      } catch (e: unknown) {
        if (controller.signal.aborted) {
          console.log(`[useFlightSearch] ABORTED (catch): ${key}`);
          return;
        }

        const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
        console.error(`[useFlightSearch] ERROR: ${msg}`);
        setError(msg);
        setResults([]);
        setIsLoading(false);
        activeKeyRef.current = null;
      }
    },
    [],
  );

  // ── Cleanup: abort on unmount (StrictMode) ──
  // Note: we do NOT clear completedKeysRef here, so remounts
  // after StrictMode don't re-trigger finished searches.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      activeKeyRef.current = null;
    };
  }, []);

  return { results, isLoading, error, search };
}