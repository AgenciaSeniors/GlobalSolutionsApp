'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

/**
 * useFlightSearch — Client-side hook for the two-phase flight search (C1.1).
 *
 * v4 — Root-cause fix for StrictMode + App Router:
 *
 * PROBLEM (v3):
 *   StrictMode runs: effect → cleanup(abort) → remount → effect.
 *   The cleanup aborted the fetch, but `lastKeyRef` was only reset inside
 *   the async catch handler of `search()`. The second mount's useEffect
 *   could fire BEFORE that microtask completed, seeing the stale key and
 *   skipping — so POST /api/flights/search never fired.
 *
 *   Additionally, `error` was a useCallback dependency, meaning every error
 *   changed the `search` reference, re-triggered the page's useEffect, and
 *   could create an infinite retry loop.
 *
 * FIX:
 *   1. Reset `lastKeyRef` SYNCHRONOUSLY in the cleanup function, not in
 *      the async abort handler. This guarantees the remounted effect sees
 *      a clean slate regardless of microtask timing.
 *   2. Remove `error` from useCallback deps. Use a ref (`errorRef`) for
 *      the retry-on-error check, so `search` has a stable identity.
 *   3. Single unified cleanup via a ref-based abort+reset pattern.
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
    return `legs:${legsKey}:p${Number.isFinite(passengers) ? passengers : 1}`;
  }

  const origin = isRecord(p) ? String(p.origin ?? '').toUpperCase() : '';
  const destination = isRecord(p) ? String(p.destination ?? '').toUpperCase() : '';
  const departure_date = isRecord(p) ? String(p.departure_date ?? '') : '';
  const passengers = isRecord(p) ? Number(p.passengers ?? 1) : 1;

  return `${origin}-${destination}-${departure_date}-p${Number.isFinite(passengers) ? passengers : 1}`;
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
  const lastKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Ref mirror of `error` so `search` can read it without being a dep ──
  const errorRef = useRef<string | null>(null);
  errorRef.current = error;

  /**
   * Abort the current in-flight request AND reset dedup state.
   * Called from cleanup and from within `search` when a new search starts.
   * MUST be synchronous so StrictMode remount sees a clean slate.
   */
  const cancelCurrent = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    lastKeyRef.current = null;
  }, []);

  /**
   * Core search function — stable identity (no state in deps).
   *
   * Dedup logic:
   *   - Same key + no prior error → skip (already fetching / already have results)
   *   - Same key + prior error → retry
   *   - Different key → new search (cancels previous)
   */
  const search = useCallback(
    async (params: FlightSearchParams): Promise<void> => {
      const key = stableRequestKey(params);

      // Dedup: skip if same key already succeeded or is in-flight
      if (lastKeyRef.current === key && !errorRef.current) {
        return;
      }

      // Cancel any previous in-flight request (sync reset of dedup key)
      cancelCurrent();

      // Set up new request
      lastKeyRef.current = key;
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setResults([]);

      try {
        // ── Phase 1: POST to create session ──
        const started = await flightsService.startSearchSession(params, {
          signal: controller.signal,
        });

        // Guard: if aborted between awaits, bail silently (no state updates)
        if (controller.signal.aborted) return;

        const initialFlights = extractFlights(started?.results as ResultsByLeg);
        setResults(initialFlights);

        // ── Phase 2: Poll if not complete ──
        const sessionId = started?.sessionId;
        const status = started?.status;

        if (sessionId && status && status !== 'complete') {
          const final = await flightsService.pollSearchSession(sessionId, {
            signal: controller.signal,
            maxWaitMs: 90_000,
            intervalMs: 2_000,
          });

          if (controller.signal.aborted) return;

          const finalFlights = extractFlights(final?.results as ResultsByLeg);
          setResults(finalFlights);
        }

        setIsLoading(false);
      } catch (e: unknown) {
        // Aborted requests = silent bail (StrictMode cleanup or user-initiated cancel)
        if (controller.signal.aborted) return;

        const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
        setError(msg);
        setResults([]);
        setIsLoading(false);
      }
    },
    [cancelCurrent],
  );

  // ── Cleanup: abort + reset on unmount (or StrictMode simulated unmount) ──
  useEffect(() => {
    return () => {
      cancelCurrent();
    };
  }, [cancelCurrent]);

  return { results, isLoading, error, search };
}