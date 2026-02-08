import type { FlightWithDetails } from '@/types/models';
import type { FlightSearchParams } from '@/types/api.types';

/**
 * Flights Service
 * Todas las búsquedas pasan por el API route (/api/flights/search)
 * para cache, seguridad y normalización.
 */
export const flightsService = {
  /**
   * Buscar vuelos (oneway / roundtrip / multicity)
   * @param params FlightSearchParams
   */
  async search(params: FlightSearchParams): Promise<FlightWithDetails[]> {
    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? 'Error buscando vuelos');
    }

    return (json.results ?? []) as FlightWithDetails[];
  },

  /**
   * Ofertas destacadas (esto puede seguir directo a Supabase si querés)
   * o migrarse después a API route.
   */
  async getExclusiveOffers(): Promise<FlightWithDetails[]> {
    const res = await fetch('/api/flights/exclusive');

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? 'Error cargando ofertas');
    }

    return (json.results ?? []) as FlightWithDetails[];
  },

  /**
   * Obtener vuelo por ID
   */
  async getById(id: string): Promise<FlightWithDetails | null> {
    const res = await fetch(`/api/flights/${id}`);

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error ?? 'Error cargando vuelo');
    }

    return (json.data ?? null) as FlightWithDetails | null;
  },
};
