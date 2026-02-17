'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

/**
 * useFlightSearch — Client-side hook for the two-phase flight search (C1.1).
 *
 * v2 — Improvements:
 *   1. Multi-leg results support (resultsByLeg)
 *   2. Progressive updates: shows cached results while live search completes
 *   3. Search metadata: source, providersUsed
 *   4. Better abort/cleanup handling
 *   5. Retry capability
 */

type ResultsByLeg = Array<{ legIndex: number; flights: FlightWithDetails[] }>;

export type UseFlightSearchResult = {
  /** Flat list of flights for leg 0 (backward compat) */
  results: FlightWithDetails[];
  /** Full multi-leg results */
  resultsByLeg: ResultsByLeg;
  isLoading: boolean;
  error: string | null;
  /** Data source: 'cache' | 'stale-cache' | 'live' | null */
  source: string | null;
  /** Which providers returned results */
  providersUsed: string[];
  search: (params: FlightSearchParams) => Promise<void>;
  /** Retry the last search */
  retry: () => Promise<void>;
};

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

function extractResultsByLeg(data: unknown): ResultsByLeg {
  if (!Array.isArray(data)) return [];
  return data
    .filter(isRecord)
    .map((r) => ({
      legIndex: Number(r.legIndex ?? 0),
      flights: Array.isArray(r.flights) ? (r.flights as FlightWithDetails[]) : [],
    }));
}

function extractLeg0Flights(resultsByLeg: ResultsByLeg): FlightWithDetails[] {
  const leg0 = resultsByLeg.find((r) => r.legIndex === 0);
  return leg0?.flights ?? [];
}

export function useFlightSearch(
  initialParams?: FlightSearchParams | null
): UseFlightSearchResult {
  const [results, setResults] = useState<FlightWithDetails[]>([]);
  const [resultsByLeg, setResultsByLeg] = useState<ResultsByLeg>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [providersUsed, setProvidersUsed] = useState<string[]>([]);

  const lastKeyRef = useRef<string | null>(null);
  const lastParamsRef = useRef<FlightSearchParams | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const applyResults = useCallback((data: unknown, src: string | null, providers: string[]) => {
    const byLeg = extractResultsByLeg(data);
    setResultsByLeg(byLeg);
    setResults(extractLeg0Flights(byLeg));
    setSource(src);
    setProvidersUsed(providers ?? []);
  }, []);

  const search = useCallback(async (params: FlightSearchParams): Promise<void> => {
    const key = stableRequestKey(params);

    // Dedupe: same request key = skip (unless there was an error)
    if (lastKeyRef.current === key && !error) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    lastKeyRef.current = key;
    lastParamsRef.current = params;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // C1.1: start session (may return cached results immediately)
      const started = await flightsService.startSearchSession(params, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      // Show initial results (may be from cache)
      if (Array.isArray(started?.results) && started.results.length > 0) {
        applyResults(
          started.results,
          started.source ?? null,
          started.providersUsed ?? []
        );
      }

      const sessionId = started?.sessionId;
      const status = started?.status;

      // If not complete, poll until completion
      if (sessionId && status && status !== 'complete') {
        const final = await flightsService.pollSearchSession(sessionId, {
          signal: controller.signal,
          maxWaitMs: 45_000,
          intervalMs: 1_500,
        });

        if (controller.signal.aborted) return;

        applyResults(
          final.results,
          final.source ?? 'live',
          final.providersUsed ?? []
        );
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;

      const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
      setError(msg);
      // Don't clear results on error — keep stale-cache results visible
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [error, applyResults]);

  const retry = useCallback(async (): Promise<void> => {
    const params = lastParamsRef.current;
    if (!params) return;

    // Force re-search by clearing the key
    lastKeyRef.current = null;
    setError(null);
    await search(params);
  }, [search]);

  // Auto-search with initial params
  const initialKey = useMemo(() => {
    if (!initialParams) return null;
    return stableRequestKey(initialParams);
  }, [initialParams]);

  useEffect(() => {
    if (!initialParams) return;
    if (initialKey && lastKeyRef.current === initialKey) return;

    void search(initialParams);
  }, [initialParams, initialKey, search]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    resultsByLeg,
    isLoading,
    error,
    source,
    providersUsed,
    search,
    retry,
  };
}
