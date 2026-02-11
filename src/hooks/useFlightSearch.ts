'use client';

import { useCallback, useState } from 'react';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';
import { flightsService } from '@/services/flights.service';

export function useFlightSearch() {
  const [results, setResults] = useState<FlightWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: FlightSearchParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await flightsService.search(params);
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error buscando vuelos');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { results, isLoading, error, search };
}
