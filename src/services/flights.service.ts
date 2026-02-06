/**
 * @fileoverview Service layer for flight-related Supabase queries.
 * @module services/flights.service
 */
import { createClient } from '@/lib/supabase/client';
import type { FlightSearchParams } from '@/types/api.types';
import type { FlightWithDetails } from '@/types/models';

async function search(params: FlightSearchParams): Promise<FlightWithDetails[]> {
  const supabase = createClient();

  let query = supabase
    .from('flights')
    .select(
      `
      *,
      airline:airlines(*),
      origin_airport:airports!origin_airport_id(*),
      destination_airport:airports!destination_airport_id(*)
    `,
    )
    .gt('available_seats', 0);

  // Filter by origin / destination airport IATA code
  if (params.origin) {
    query = query.eq('origin_airport.iata_code', params.origin);
  }
  if (params.destination) {
    query = query.eq('destination_airport.iata_code', params.destination);
  }

  // Filter by departure date (same day)
  if (params.departure_date) {
    const start = `${params.departure_date}T00:00:00`;
    const end = `${params.departure_date}T23:59:59`;
    query = query.gte('departure_datetime', start).lte('departure_datetime', end);
  }

  query = query.order('final_price', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as unknown as FlightWithDetails[];
}

async function getExclusiveOffers(): Promise<FlightWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      airline:airlines(*),
      origin_airport:airports!origin_airport_id(*),
      destination_airport:airports!destination_airport_id(*)
    `,
    )
    .eq('is_exclusive_offer', true)
    .gt('available_seats', 0)
    .order('final_price', { ascending: true })
    .limit(8);

  if (error) throw error;
  return (data ?? []) as unknown as FlightWithDetails[];
}

async function getById(id: string): Promise<FlightWithDetails | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('flights')
    .select(
      `
      *,
      airline:airlines(*),
      origin_airport:airports!origin_airport_id(*),
      destination_airport:airports!destination_airport_id(*)
    `,
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as FlightWithDetails;
}

export const flightsService = { search, getExclusiveOffers, getById };
