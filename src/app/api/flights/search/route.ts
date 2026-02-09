import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightSearchParams, FlightLeg, FlightSearchFilters } from '@/types/api.types';
import { seedDbProvider } from '@/lib/flights/providers/seedDbProvider';

const TTL_MINUTES = 15;

// En este endpoint devolvemos objetos de vuelos “con campos extra” (joins, etc.).
// Para evitar `any`, usamos un record genérico.
type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toUpperString(v: unknown): string {
  return String(v ?? '').toUpperCase();
}

function normalizeFilters(raw: unknown): FlightSearchFilters | undefined {
  if (!raw || !isRecord(raw)) return undefined;

  const airlineCodesRaw = raw.airlineCodes;
  const airlineCodes =
    Array.isArray(airlineCodesRaw) && airlineCodesRaw.length
      ? airlineCodesRaw.map((c) => toUpperString(c)).sort()
      : undefined;

  const minPrice = raw.minPrice != null ? Number(raw.minPrice) : undefined;
  const maxPrice = raw.maxPrice != null ? Number(raw.maxPrice) : undefined;

  const dtr = raw.departureTimeRange;
  const departureTimeRange =
    isRecord(dtr) && dtr.from != null && dtr.to != null
      ? { from: String(dtr.from), to: String(dtr.to) }
      : undefined;

  const maxStops = raw.maxStops != null ? Number(raw.maxStops) : undefined;

  return { airlineCodes, minPrice, maxPrice, departureTimeRange, maxStops };
}

function normalizeToRequest(params: FlightSearchParams): {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
} {
  const anyParams: unknown = params;
  const filters = normalizeFilters(isRecord(anyParams) ? anyParams.filters : undefined);

  // New format: { legs: [...], passengers }
  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    return {
      legs: params.legs.map((l) => ({
        origin: String(l.origin).toUpperCase(),
        destination: String(l.destination).toUpperCase(),
        departure_date: l.departure_date,
      })),
      passengers: params.passengers,
      filters,
    };
  }

  // Legacy format: { origin, destination, departure_date, return_date?, passengers }
  const origin = isRecord(anyParams) ? toUpperString(anyParams.origin) : '';
  const destination = isRecord(anyParams) ? toUpperString(anyParams.destination) : '';
  const departure_date = isRecord(anyParams) ? String(anyParams.departure_date ?? '') : '';
  const passengers = isRecord(anyParams) ? Number(anyParams.passengers ?? 1) : 1;

  const legs: FlightLeg[] = [{ origin, destination, departure_date }];

  const returnDate = isRecord(anyParams) ? anyParams.return_date : undefined;
  if (returnDate) {
    legs.push({
      origin: destination,
      destination: origin,
      departure_date: String(returnDate ?? ''),
    });
  }

  return { legs, passengers, filters };
}

function makeCacheKey(body: { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters }) {
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

function isValidHHMM(x: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
}

function readNumberField(obj: FlightRecord, key: string): number | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

async function getAirlineIdsByCodes(
  supabase: ReturnType<typeof createAdminClient>,
  airlineCodes: string[],
): Promise<{ ids: string[]; error?: string }> {
  // Try common column names: iata_code first, then code.
  const tryCols = ['iata_code', 'code'] as const;

  for (const col of tryCols) {
    const { data, error } = await supabase.from('airlines').select(`id, ${col}`).in(col, airlineCodes);

    if (!error) {
      const ids = (data ?? [])
        .map((a) => {
          if (!a) return null;
          // `a` es un row de Supabase; tipado real depende del schema.
          // Lo tratamos como record seguro.
          const rec = a as unknown;
          if (!isRecord(rec)) return null;
          const id = rec.id;
          return id == null ? null : String(id);
        })
        .filter((x): x is string => Boolean(x));

      return { ids };
    }

    // if the column doesn't exist, try next
    const msg = String((error as unknown as { message?: unknown }).message ?? '');
    if (!msg.includes(col)) return { ids: [], error: msg };
  }

  return { ids: [], error: 'No se pudo filtrar aerolíneas: falta columna iata_code/code en airlines.' };
}

export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    const raw = (await req.json()) as FlightSearchParams;
    const body = normalizeToRequest(raw);

    if (
      !body.legs.length ||
      !body.legs[0].origin ||
      !body.legs[0].destination ||
      !body.legs[0].departure_date ||
      !Number.isFinite(body.passengers) ||
      body.passengers < 1
    ) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (legs/origin/destination/departure_date/passengers)' },
        { status: 400 },
      );
    }

    // Validate time range if provided (same-day window)
    if (body.filters?.departureTimeRange) {
      const { from, to } = body.filters.departureTimeRange;
      if (!isValidHHMM(from) || !isValidHHMM(to)) {
        return NextResponse.json({ error: 'departureTimeRange inválido. Use "HH:MM" 24h.' }, { status: 400 });
      }
      if (from > to) {
        return NextResponse.json(
          { error: 'departureTimeRange inválido: "from" debe ser <= "to" (mismo día).' },
          { status: 400 },
        );
      }
    }

    const cache_key = makeCacheKey(body);
    const nowIso = new Date().toISOString();

    // 1) CACHE HIT
    const { data: cached, error: cacheErr } = await supabase
      .from('flight_search_cache')
      .select('response, expires_at')
      .eq('cache_key', cache_key)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (cacheErr) console.warn('flight_search_cache read error:', cacheErr.message);

    if (cached?.response) {
      console.info('[FLIGHTS_SEARCH] source=cache', { cache_key });
      return NextResponse.json({ source: 'cache', results: cached.response });
    }

    // 2) LIVE — provider (agency-first friendly). Si el provider falla, usamos fallback legacy abajo.
    const provider = seedDbProvider;
    console.info('[FLIGHTS_SEARCH] source=live', { cache_key, provider: provider.id });

    let resultsByLeg: ResultsByLeg | null = null;

    try {
      const providerRes = await provider.search(body);
      // provider.search puede devolver flights con más campos; lo normalizamos a FlightRecord[]
      resultsByLeg = providerRes.map((r) => ({
        legIndex: r.legIndex,
        flights: (r.flights as unknown[]).filter(isRecord) as FlightRecord[],
      }));
    } catch (e: unknown) {
      const msg = String(isRecord(e) ? e.message : e ?? '');
      if (msg.startsWith('IATA inválido')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      console.warn('[FLIGHTS_SEARCH] provider error, usando fallback legacy:', msg);
    }

    // === FALLBACK LEGACY (TU BLOQUE LIVE ORIGINAL, SIN SIMPLIFICAR) ===
    if (!resultsByLeg) {
      // 2) LIVE — B: resolver IATA -> airport_id en 1 sola query
      const allIatas = Array.from(new Set(body.legs.flatMap((l) => [l.origin, l.destination])));

      const { data: airportsAll, error: airportsAllErr } = await supabase
        .from('airports')
        .select('id, iata_code')
        .in('iata_code', allIatas);

      if (airportsAllErr) {
        return NextResponse.json({ error: airportsAllErr.message }, { status: 500 });
      }

      const airportIdByIata = new Map<string, string>();
      for (const a of airportsAll ?? []) {
        const rec = a as unknown;
        if (!isRecord(rec)) continue;
        const iata = rec.iata_code;
        const id = rec.id;
        if (iata != null && id != null) airportIdByIata.set(String(iata), String(id));
      }

      // C: airline filter (resolve once)
      let airlineIdsFilter: string[] | null = null;
      if (body.filters?.airlineCodes?.length) {
        const { ids, error } = await getAirlineIdsByCodes(supabase, body.filters.airlineCodes);
        if (error) return NextResponse.json({ error }, { status: 500 });
        airlineIdsFilter = ids;

        // If user asked for airlines and none exist, return empty quickly
        if (!airlineIdsFilter.length) {
          const empty: ResultsByLeg = body.legs.map((_, i) => ({ legIndex: i, flights: [] }));
          return NextResponse.json({ source: 'live', results: empty });
        }
      }

      const resultsByLegLegacy: ResultsByLeg = [];

      for (let i = 0; i < body.legs.length; i++) {
        const leg = body.legs[i];

        const originId = airportIdByIata.get(leg.origin);
        const destinationId = airportIdByIata.get(leg.destination);

        if (!originId || !destinationId) {
          return NextResponse.json({ error: `IATA inválido en tramo ${i + 1}` }, { status: 400 });
        }

        // Date window (full day) or narrowed by time range
        let start = `${leg.departure_date}T00:00:00`;
        let end = `${leg.departure_date}T23:59:59`;

        if (body.filters?.departureTimeRange) {
          start = `${leg.departure_date}T${body.filters.departureTimeRange.from}:00`;
          end = `${leg.departure_date}T${body.filters.departureTimeRange.to}:00`;
        }

        let q = supabase
          .from('flights')
          .select(
            `
          *,
          airline:airlines(*),
          origin_airport:airports!origin_airport_id(*),
          destination_airport:airports!destination_airport_id(*)
        `,
          )
          .gt('available_seats', 0)
          .eq('origin_airport_id', originId)
          .eq('destination_airport_id', destinationId)
          .gte('departure_datetime', start)
          .lte('departure_datetime', end)
          .order('final_price', { ascending: true });

        // Price filters (SQL)
        if (body.filters?.minPrice != null) q = q.gte('final_price', body.filters.minPrice);
        if (body.filters?.maxPrice != null) q = q.lte('final_price', body.filters.maxPrice);

        // Airline filter (SQL)
        if (airlineIdsFilter?.length) q = q.in('airline_id', airlineIdsFilter);

        const { data: flightsRaw, error: flightsErr } = await q;

        if (flightsErr) {
          return NextResponse.json({ error: flightsErr.message }, { status: 500 });
        }

        // maxStops (best-effort in-memory)
        let flights: FlightRecord[] = (flightsRaw as unknown[])
          .filter(isRecord) as FlightRecord[];

        if (body.filters?.maxStops != null) {
          const maxStops = body.filters.maxStops;

          flights = flights.filter((f) => {
            // Intentamos varias claves conocidas sin asumir tipos.
            let stops =
              readNumberField(f, 'stops_count') ??
              readNumberField(f, 'number_of_stops') ??
              readNumberField(f, 'stops') ??
              readNumberField(f, 'stop_count');

            if (stops == null) {
              const seg = readNumberField(f, 'segments_count');
              if (seg != null) stops = Math.max(0, seg - 1);
            }

            if (stops == null) return true; // no evaluable => keep
            return stops <= maxStops;
          });
        }

        resultsByLegLegacy.push({ legIndex: i, flights });
      }

      resultsByLeg = resultsByLegLegacy;
    }

    const finalResults = resultsByLeg as ResultsByLeg;

    // 3) Cache store (TTL 15 min)
    const expires_at = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from('flight_search_cache')
      .upsert({ cache_key, response: finalResults, expires_at }, { onConflict: 'cache_key' });

    if (upsertErr) console.warn('flight_search_cache upsert error:', upsertErr.message);

    return NextResponse.json({ source: 'live', results: finalResults });
  } catch (err: unknown) {
    console.error('[FLIGHT_SEARCH_ERROR]', err);
    const msg = String(isRecord(err) ? err.message : err ?? 'Internal server error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
