/**
 * @fileoverview GET /api/flights — Public flight search endpoint.
 * @module app/api/flights/route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const origin = searchParams.get('from');
    const destination = searchParams.get('to');
    const departure = searchParams.get('departure');

    const supabase = await createClient();

    let query = supabase
      .from('flights')
      .select(`
        *,
        airline:airlines(*),
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .gt('available_seats', 0)
      .order('final_price', { ascending: true });

    if (departure) {
      query = query
        .gte('departure_datetime', `${departure}T00:00:00`)
        .lte('departure_datetime', `${departure}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by airport IATA code in application layer
    let flights = data ?? [];
    if (origin) {
      flights = flights.filter(
        (f: Record<string, unknown>) =>
          (f.origin_airport as Record<string, unknown>)?.iata_code === origin,
      );
    }
    if (destination) {
      flights = flights.filter(
        (f: Record<string, unknown>) =>
          (f.destination_airport as Record<string, unknown>)?.iata_code === destination,
      );
    }

    return NextResponse.json({ data: flights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
