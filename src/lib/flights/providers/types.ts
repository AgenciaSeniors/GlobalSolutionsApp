import type { FlightLeg, FlightSearchFilters } from "@/types/api.types";

export type Flight = {
  id: string;
  price: number;
  duration: number;
  raw?: unknown;
  [key: string]: unknown;
};

export type ProviderSearchRequest = {
  legs: FlightLeg[];
  passengers: number;
  cabinClass?: string;
  filters?: FlightSearchFilters;
};

export type ProviderSearchResponse = Array<{ legIndex: number; flights: Flight[] }>;

export interface FlightsProvider {
  /** Unique provider identifier (e.g. "seed-db", "duffel", "amadeus"). */
  id: string;

  /** Search for flights for one or more legs. */
  search(
    req: ProviderSearchRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<ProviderSearchResponse>;
}
