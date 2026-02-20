/**
 * Flight Search v2 (multi-tramo) - Tipos para el contrato nuevo:
 * POST /api/flights/search
 */

// 1) Un tramo (leg)
export type FlightLeg = {
  origin: string;          // IATA origen (ej: "EZE")
  destination: string;     // IATA destino (ej: "MAD")
  departure_date: string;  // "YYYY-MM-DD"
};

// 2) Pasajeros (más real que "un número")
export type PassengerCounts = {
  adults: number;
  children?: number;
  infants?: number;
};

// 3) Filtros (todos opcionales)
export type FlightSearchFilters = {
  airlineCodes?: string[];          // ["AA","IB"]
  minPrice?: number;               // 100
  maxPrice?: number;               // 800
  departureTimeRange?: [string, string]; // ["06:00","18:00"]
  maxStops?: number;               // 0, 1, 2...
};

// 4) Request completo del endpoint
export type FlightSearchRequest = {
  legs: FlightLeg[];
  passengers: PassengerCounts;
  filters?: FlightSearchFilters;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
};

// 5) Respuesta (mínima y compatible con el checklist)
// Nota: "Flight" lo dejamos como unknown por ahora porque el backend final
// puede variar. Más adelante lo tipamos cuando el backend esté estabilizado.
export type FlightSearchLegResult = {
  legIndex: number;
  flights: unknown[];
};

export type FlightSearchResponse = {
  source: "cache" | "live";
  results: FlightSearchLegResult[];
};
