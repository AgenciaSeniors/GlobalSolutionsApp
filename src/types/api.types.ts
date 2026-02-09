/**
 * @fileoverview Shared request / response types for API routes and services.
 * @module types/api
 */

/* ------------------------------------------------------------------ */
/*  GENERIC                                                           */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

/* ------------------------------------------------------------------ */
/*  FLIGHTS                                                           */
/* ------------------------------------------------------------------ */

export type FlightLeg = {
  origin: string; // IATA
  destination: string; // IATA
  departure_date: string; // YYYY-MM-DD
};

export type FlightSearchFilters = {
  airlineCodes?: string[]; // e.g. ["CM","AA"]
  minPrice?: number;
  maxPrice?: number;
  departureTimeRange?: { from: string; to: string }; // "HH:MM" 24h
  maxStops?: number; // best-effort (depende de tu schema)
};

export type FlightSearchParams =
  | {
      legs: FlightLeg[];
      passengers: number;
      filters?: FlightSearchFilters;
    }
  | {
      // legacy (para no romper lo actual hoy)
      origin: string;
      destination: string;
      departure_date: string;
      return_date?: string;
      passengers: number;
      filters?: FlightSearchFilters;
    };

/* ------------------------------------------------------------------ */
/*  BOOKINGS                                                          */
/* ------------------------------------------------------------------ */

export interface CreateBookingPayload {
  flight_id: string;
  passengers: PassengerPayload[];
}

export interface PassengerPayload {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry_date: string;
}

/* ------------------------------------------------------------------ */
/*  PAYMENTS                                                          */
/* ------------------------------------------------------------------ */

export interface CreatePaymentIntentPayload {
  booking_id: string;
}

export interface PaymentIntentResponse {
  client_secret: string;
}
