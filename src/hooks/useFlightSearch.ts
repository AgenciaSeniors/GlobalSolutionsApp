'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

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

  // legs (multi-leg) si existen
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

  // legacy: origin/destination/departure_date/passengers
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

  // Prevent duplicate calls from StrictMode / re-renders
  const lastKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (params: FlightSearchParams): Promise<void> => {
    const key = stableRequestKey(params);

    // Dedupe: same request key = skip
    if (lastKeyRef.current === key && !error) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    lastKeyRef.current = key;
    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const data = await flightsService.search(params);

      // If this request was aborted while in flight, discard
      if (controller.signal.aborted) return;

      setResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;

      const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
      setError(msg);
      setResults([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      inFlightRef.current = false;
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
