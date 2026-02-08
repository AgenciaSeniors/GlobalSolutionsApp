import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightSearchParams, FlightLeg } from '@/types/api.types';

const TTL_MINUTES = 15;

function normalizeToLegs(params: FlightSearchParams): { legs: FlightLeg[]; passengers: number } {
  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    return {
      legs: params.legs.map((l) => ({
        origin: l.origin.toUpperCase(),
        destination: l.destination.toUpperCase(),
        departure_date: l.departure_date,
      })),
      passengers: params.passengers,
    };
  }

  const legacy = params as any;
  const legs: FlightLeg[] = [
    {
      origin: String(legacy.origin ?? '').toUpperCase(),
      destination: String(legacy.destination ?? '').toUpperCase(),
      departure_date: String(legacy.departure_date ?? ''),
    },
  ];

  if (legacy.return_date) {
    legs.push({
      origin: String(legacy.destination ?? '').toUpperCase(),
      destination: String(legacy.origin ?? '').toUpperCase(),
      departure_date: String(legacy.return_date ?? ''),
    });
  }

  return { legs, passengers: Number(legacy.passengers ?? 1) };
}

function makeCacheKey(body: { legs: FlightLeg[]; passengers: number }) {
  return JSON.stringify({
    legs: body.legs.map((l) => ({ o: l.origin, d: l.destination, dt: l.departure_date })),
    p: body.passengers,
  });
}

export async function POST(req: Request) {
  const supabase = createAdminClient();
    console.log('[FLIGHT_SEARCH] using service role:', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));

  try {
    const raw = (await req.json()) as FlightSearchParams;
    const body = normalizeToLegs(raw);

    if (
      !body.legs.length ||
      !body.legs[0].origin ||
      !body.legs[0].destination ||
      !body.legs[0].departure_date
    ) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (legs/origin/destination/departure_date)' },
        { status: 400 }
      );
    }

    const cache_key = makeCacheKey(body);
    const now = new Date().toISOString();

    // 1) Cache hit
    const { data: cached, error: cacheErr } = await supabase
      .from('flight_search_cache')
      .select('response, expires_at')
      .eq('cache_key', cache_key)
      .gt('expires_at', now)
      .maybeSingle();

    if (cacheErr) {
      console.warn('flight_search_cache read error:', cacheErr.message);
    }

    if (cached?.response) {
      return NextResponse.json({ source: 'cache', results: cached.response });
    }

    // 2) LIVE (tabla flights)
    const leg0 = body.legs[0];
    const start = `${leg0.departure_date}T00:00:00`;
    const end = `${leg0.departure_date}T23:59:59`;

    // Resolver IATA -> airport_id
    const { data: airports, error: airportsErr } = await supabase
      .from('airports')
      .select('id, iata_code')
      .in('iata_code', [leg0.origin, leg0.destination]);

    if (airportsErr) {
      return NextResponse.json({ error: airportsErr.message }, { status: 500 });
    }

    const originAirport = airports?.find((a) => a.iata_code === leg0.origin);
    const destinationAirport = airports?.find((a) => a.iata_code === leg0.destination);

    if (!originAirport || !destinationAirport) {
      return NextResponse.json({ error: 'IATA inválido: airport no encontrado' }, { status: 400 });
    }

    const { data: flights, error: flightsErr } = await supabase
      .from('flights')
      .select(
        `
        *,
        airline:airlines(*),
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `
      )
      .gt('available_seats', 0)
      .eq('origin_airport_id', originAirport.id)
      .eq('destination_airport_id', destinationAirport.id)
      .gte('departure_datetime', start)
      .lte('departure_datetime', end)
      .order('final_price', { ascending: true });

    if (flightsErr) {
      return NextResponse.json({ error: flightsErr.message }, { status: 500 });
    }

    // 3) Cache store
    const expires_at = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from('flight_search_cache')
      .upsert(
        {
          cache_key,
          response: flights ?? [],
          expires_at,
        },
        { onConflict: 'cache_key' }
      );

    if (upsertErr) {
      console.warn('flight_search_cache upsert error:', upsertErr.message);
    }

    return NextResponse.json({ source: 'live', results: flights ?? [] });
  } catch (err: any) {
    console.error('[FLIGHT_SEARCH_ERROR]', err);
    // En dev, devolvemos el mensaje para depurar (sin stack)
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
