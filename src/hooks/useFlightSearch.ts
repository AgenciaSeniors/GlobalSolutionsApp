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

  // evita spam por re-renders/strict-mode
  const lastKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const search = useCallback(async (params: FlightSearchParams): Promise<void> => {
    const key = stableRequestKey(params);

    // ✅ dedupe: si es el mismo requestKey, no repitas
    if (lastKeyRef.current === key) return;

    // ✅ evita disparos paralelos si hay un request en vuelo
    if (inFlightRef.current) return;

    lastKeyRef.current = key;
    inFlightRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const data = await flightsService.search(params);
      setResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error buscando vuelos';
      setError(msg);
      setResults([]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  const initialKey = useMemo(() => {
    if (!initialParams) return null;
    return stableRequestKey(initialParams);
  }, [initialParams]);

  useEffect(() => {
    if (!initialParams) return;

    // evita re-llamar initial si ya lo hicimos
    if (initialKey && lastKeyRef.current === initialKey) return;

    void search(initialParams);
  }, [initialParams, initialKey, search]);

  return { results, isLoading, error, search };
}
