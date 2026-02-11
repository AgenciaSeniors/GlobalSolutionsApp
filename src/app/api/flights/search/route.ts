/**
 * @fileoverview POST /api/flights/search — Buscador de vuelos con tipos estrictos, protección y caché.
 * @module app/api/flights/search/route
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightSearchParams, FlightLeg, FlightSearchFilters } from '@/types/api.types';

const TTL_MINUTES = 15;

// ✅ 1. Definición de interfaces para modelos de datos
interface Airport {
  id: string;
  iata_code: string;
  name: string;
}

interface Airline {
  id: string;
  iata_code: string;
  name: string;
}

interface Flight {
  id: string;
  final_price: number;
  available_seats: number;
  departure_datetime: string;
  airline: Airline | null;
  origin_airport: Airport | null;
  destination_airport: Airport | null;
  // Campos posibles para escalas según el esquema
  stops_count?: number;
  number_of_stops?: number;
  stops?: number;
  stop_count?: number;
  segments_count?: number;
}

interface RateLimit {
  ip_address: string;
  last_search_at: string;
  search_count: number;
}

type ResultsByLeg = Array<{ legIndex: number; flights: Flight[] }>;

// ✅ 2. Funciones auxiliares tipadas
function normalizeFilters(raw: Partial<FlightSearchFilters> | undefined): FlightSearchFilters | undefined {
  if (!raw) return undefined;

  const airlineCodes =
    Array.isArray(raw.airlineCodes) && raw.airlineCodes.length
      ? raw.airlineCodes.map((c) => String(c).toUpperCase()).sort()
      : undefined;

  const minPrice = raw.minPrice != null ? Number(raw.minPrice) : undefined;
  const maxPrice = raw.maxPrice != null ? Number(raw.maxPrice) : undefined;

  const departureTimeRange =
    raw.departureTimeRange?.from && raw.departureTimeRange?.to
      ? { from: String(raw.departureTimeRange.from), to: String(raw.departureTimeRange.to) }
      : undefined;

  const maxStops = raw.maxStops != null ? Number(raw.maxStops) : undefined;

  return { airlineCodes, minPrice, maxPrice, departureTimeRange, maxStops };
}

function normalizeToRequest(params: FlightSearchParams): {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
} {
  // Usamos una interfaz temporal para manejar la flexibilidad del input sin any
  interface LegacyParams {
    origin?: string;
    destination?: string;
    departure_date?: string;
    return_date?: string;
    passengers?: number;
    filters?: Partial<FlightSearchFilters>;
  }

  const p = params as unknown as LegacyParams;
  const filters = normalizeFilters(p.filters);

  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    return {
      legs: params.legs.map((l) => ({
        origin: l.origin.toUpperCase(),
        destination: l.destination.toUpperCase(),
        departure_date: l.departure_date,
      })),
      passengers: params.passengers,
      filters,
    };
  }

  const origin = (p.origin ?? '').toUpperCase();
  const destination = (p.destination ?? '').toUpperCase();
  const departure_date = p.departure_date ?? '';
  const passengers = p.passengers ?? 1;

  const legs: FlightLeg[] = [{ origin, destination, departure_date }];

  if (p.return_date) {
    legs.push({
      origin: destination,
      destination: origin,
      departure_date: p.return_date,
    });
  }

  return { legs, passengers, filters };
}

function makeCacheKey(body: { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters }): string {
  const legsKey = body.legs
    .map((l) => `${l.origin.toUpperCase()}-${l.destination.toUpperCase()}-${l.departure_date}`)
    .join('|');

  const f = body.filters;
  const parts: string[] = [];

  if (f?.airlineCodes?.length) parts.push(`air=${f.airlineCodes.join(',')}`);
  if (f?.minPrice != null) parts.push(`min=${f.minPrice}`);
  if (f?.maxPrice != null) parts.push(`max=${f.maxPrice}`);
  if (f?.departureTimeRange?.from && f?.departureTimeRange?.to)
    parts.push(`time=${f.departureTimeRange.from}-${f.departureTimeRange.to}`);
  if (f?.maxStops != null) parts.push(`stops=${f.maxStops}`);

  const filtersKey = parts.length ? `:${parts.join(':')}` : '';
  return `flights:${legsKey}:p${body.passengers}${filtersKey}`;
}

function isValidHHMM(x: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
}

async function getAirlineIdsByCodes(
  supabase: ReturnType<typeof createAdminClient>,
  airlineCodes: string[],
): Promise<{ ids: string[]; error?: string }> {
  const tryCols = ['iata_code', 'code'] as const;

  for (const col of tryCols) {
    const { data, error } = await supabase.from('airlines').select(`id, ${col}`).in(col, airlineCodes);
    if (!error) return { ids: (data ?? []).map((a) => (a as { id: string }).id) };

    const msg = String(error.message ?? '');
    if (!msg.includes(col)) return { ids: [], error: msg };
  }

  return { ids: [], error: 'No se pudo filtrar aerolíneas: error de esquema.' };
}

export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    // 🛡️ 1) RATE LIMIT
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const now = new Date();

    const { data: rlData } = await supabase
      .from('search_rate_limits')
      .select('*')
      .eq('ip_address', ip)
      .maybeSingle();

    const rl = rlData as RateLimit | null;

    if (rl) {
      const diffMs = now.getTime() - new Date(rl.last_search_at).getTime();
      if (rl.search_count >= 5 && diffMs < 30000) {
        return NextResponse.json(
          { error: 'Demasiadas búsquedas. Intente de nuevo en breve.' },
          { status: 429 }
        );
      }
      const newCount = diffMs > 30000 ? 1 : rl.search_count + 1;
      await supabase
        .from('search_rate_limits')
        .update({ last_search_at: now.toISOString(), search_count: newCount })
        .eq('ip_address', ip);
    } else {
      await supabase
        .from('search_rate_limits')
        .insert({ ip_address: ip, last_search_at: now.toISOString(), search_count: 1 });
    }

    const raw = (await req.json()) as FlightSearchParams;
    const body = normalizeToRequest(raw);

    // Validación básica
    if (!body.legs.length || !body.legs[0].origin || !Number.isFinite(body.passengers)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const cache_key = makeCacheKey(body);
    const nowIso = new Date().toISOString();

    // 2) CACHE HIT
    const { data: cached } = await supabase
      .from('flight_search_cache')
      .select('response, expires_at')
      .eq('cache_key', cache_key)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (cached?.response) {
      return NextResponse.json({ source: 'cache', results: cached.response as ResultsByLeg });
    }

    // 3) LIVE SEARCH
    const allIatas = Array.from(new Set(body.legs.flatMap((l) => [l.origin, l.destination])));
    const { data: airportsAll } = await supabase
      .from('airports')
      .select('id, iata_code')
      .in('iata_code', allIatas);

    const airportIdByIata = new Map<string, string>();
    (airportsAll as Airport[] ?? []).forEach(a => airportIdByIata.set(a.iata_code, a.id));

    let airlineIdsFilter: string[] | null = null;
    if (body.filters?.airlineCodes?.length) {
      const { ids, error } = await getAirlineIdsByCodes(supabase, body.filters.airlineCodes);
      if (error) return NextResponse.json({ error }, { status: 500 });
      airlineIdsFilter = ids;
    }

    const resultsByLeg: ResultsByLeg = [];

    for (let i = 0; i < body.legs.length; i++) {
      const leg = body.legs[i];
      const originId = airportIdByIata.get(leg.origin);
      const destinationId = airportIdByIata.get(leg.destination);

      if (!originId || !destinationId) continue;

      let q = supabase
        .from('flights')
        .select(`
          *,
          airline:airlines(*),
          origin_airport:airports!origin_airport_id(*),
          destination_airport:airports!destination_airport_id(*)
        `)
        .gt('available_seats', 0)
        .eq('origin_airport_id', originId)
        .eq('destination_airport_id', destinationId)
        .gte('departure_datetime', `${leg.departure_date}T00:00:00`)
        .lte('departure_datetime', `${leg.departure_date}T23:59:59`);

      if (body.filters?.minPrice != null) q = q.gte('final_price', body.filters.minPrice);
      if (body.filters?.maxPrice != null) q = q.lte('final_price', body.filters.maxPrice);
      if (airlineIdsFilter?.length) q = q.in('airline_id', airlineIdsFilter);

      const { data: flightsRaw } = await q;
      let flights = (flightsRaw as unknown as Flight[]) ?? [];

      // Filtrado manual para campos complejos (escalas)
      if (body.filters?.maxStops != null) {
        const max = body.filters.maxStops;
        flights = flights.filter(f => {
          const s = f.stops_count ?? f.number_of_stops ?? f.stops ?? f.stop_count ?? (f.segments_count ? f.segments_count - 1 : 0);
          return s <= max;
        });
      }

      resultsByLeg.push({ legIndex: i, flights });
    }

    // 4) CACHE STORE
    const expires_at = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();
    await supabase.from('flight_search_cache').upsert(
      { cache_key, response: resultsByLeg, expires_at },
      { onConflict: 'cache_key' }
    );

    return NextResponse.json({ source: 'live', results: resultsByLeg });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}