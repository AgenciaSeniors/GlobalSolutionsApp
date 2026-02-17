'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

/**
 * useFlightSearch — Client-side hook for the two-phase flight search (C1.1).
 *
 * v3 — Critical fix:
 *   StrictMode in dev runs: effect → cleanup (abort) → effect again.
 *   The cleanup aborts the in-flight fetch, but the dedup refs (lastKeyRef)
 *   still held the key, so the second effect run saw "already searched" and
 *   skipped. Fix: reset lastKeyRef when a request is aborted by cleanup.
 */

export type UseFlightSearchResult = {
  results: FlightWithDetails[];
  isLoading: boolean;
  error: string | null;
  search: (params: FlightSearchParams) => Promise<void>;
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

export function useFlightSearch(initialParams?: FlightSearchParams | null): UseFlightSearchResult {
  const [results, setResults] = useState<FlightWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lastKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (params: FlightSearchParams): Promise<void> => {
    const key = stableRequestKey(params);

    // Dedupe: same request key = skip (unless previous had error)
    if (lastKeyRef.current === key && !error) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    lastKeyRef.current = key;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const started = await flightsService.startSearchSession(params, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        // ── FIX: reset key so StrictMode re-mount can retry ──
        if (lastKeyRef.current === key) lastKeyRef.current = null;
        return;
      }

      const initialFlights =
        Array.isArray(started?.results) &&
        started.results.length &&
        started.results[0]?.flights
          ? (started.results[0].flights ?? [])
          : [];

      setResults(
        Array.isArray(initialFlights) ? (initialFlights as FlightWithDetails[]) : []
      );

      const sessionId = started?.sessionId;
      const status = started?.status;

      if (sessionId && status && status !== 'complete') {
        const final = await flightsService.pollSearchSession(sessionId, {
          signal: controller.signal,
          maxWaitMs: 45_000,
          intervalMs: 1_500,
        });

        if (controller.signal.aborted) {
          if (lastKeyRef.current === key) lastKeyRef.current = null;
          return;
        }

        const finalFlights =
          Array.isArray(final?.results) &&
          final.results.length &&
          final.results[0]?.flights
            ? (final.results[0].flights ?? [])
            : [];

        setResults(
          Array.isArray(finalFlights) ? (finalFlights as FlightWithDetails[]) : []
        );
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        // ── FIX: reset key so StrictMode re-mount can retry ──
        if (lastKeyRef.current === key) lastKeyRef.current = null;
        return;
      }

      const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
      setError(msg);
      setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [error]);

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

  return { results, isLoading, error, search };
}