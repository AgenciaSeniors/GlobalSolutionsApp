/**
 * POST /api/flights/search — Buscador de vuelos con tipos estrictos, protección, caché y fallback DB.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightSearchParams, FlightLeg, FlightSearchFilters } from '@/types/api.types';
import { flightsOrchestrator } from '@/lib/flights/orchestrator/flightsOrchestrator';

const TTL_MINUTES = 15;

// Strict types (no `any`)
type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidIATA(x: string): boolean {
  return /^[A-Z]{3}$/.test(x);
}

function isValidDateYYYYMMDD(x: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function isValidHHMM(x: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
}

function readNumberField(obj: FlightRecord, key: string): number | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeFilters(raw: unknown): FlightSearchFilters | undefined {
  if (!raw || !isRecord(raw)) return undefined;

  const airlineCodes =
    Array.isArray(raw.airlineCodes) && raw.airlineCodes.length
      ? raw.airlineCodes.map((c) => String(c).toUpperCase()).sort()
      : undefined;

  const minPrice = raw.minPrice != null ? Number(raw.minPrice) : undefined;
  const maxPrice = raw.maxPrice != null ? Number(raw.maxPrice) : undefined;

  const departureTimeRange =
    isRecord(raw.departureTimeRange) && raw.departureTimeRange.from && raw.departureTimeRange.to
      ? { from: String(raw.departureTimeRange.from), to: String(raw.departureTimeRange.to) }
      : undefined;

  const maxStops = raw.maxStops != null ? Number(raw.maxStops) : undefined;

  // Sanitización final
  const cleaned: FlightSearchFilters = {};
  if (airlineCodes?.length) cleaned.airlineCodes = airlineCodes;
  if (Number.isFinite(minPrice as number)) cleaned.minPrice = minPrice;
  if (Number.isFinite(maxPrice as number)) cleaned.maxPrice = maxPrice;
  if (departureTimeRange?.from && departureTimeRange?.to) cleaned.departureTimeRange = departureTimeRange;
  if (Number.isFinite(maxStops as number)) cleaned.maxStops = maxStops;

  return Object.keys(cleaned).length ? cleaned : undefined;
}

function normalizeToRequest(params: FlightSearchParams): {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
} {
  const anyParams: unknown = params;
  const filters = normalizeFilters(isRecord(anyParams) ? anyParams.filters : undefined);

  // New format: { legs, passengers, filters }
  if ('legs' in params && Array.isArray(params.legs) && params.legs.length > 0) {
    const legs = params.legs.map((l) => ({
      origin: String(l.origin).toUpperCase(),
      destination: String(l.destination).toUpperCase(),
      departure_date: String(l.departure_date),
    }));

    return { legs, passengers: Number(params.passengers ?? 1), filters };
  }

  // Legacy format: { origin, destination, departure_date, return_date?, passengers, filters? }
  const origin = isRecord(anyParams) ? String(anyParams.origin ?? '').toUpperCase() : '';
  const destination = isRecord(anyParams) ? String(anyParams.destination ?? '').toUpperCase() : '';
  const departure_date = isRecord(anyParams) ? String(anyParams.departure_date ?? '') : '';
  const passengers = isRecord(anyParams) ? Number(anyParams.passengers ?? 1) : 1;

  const legs: FlightLeg[] = [{ origin, destination, departure_date }];

  if (isRecord(anyParams) && anyParams.return_date) {
    legs.push({
      origin: destination,
      destination: origin,
      departure_date: String(anyParams.return_date),
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

function extractProvidersUsed(results: ResultsByLeg): string[] {
  const set = new Set<string>();
  for (const leg of results) {
    for (const f of leg.flights) {
      const p = f.provider;
      if (typeof p === 'string' && p.trim()) set.add(p.trim());
    }
  }
  return Array.from(set).sort();
}

function validateRequest(body: { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters }): string | null {
  if (!Array.isArray(body.legs) || body.legs.length === 0) return 'Parámetros inválidos: legs vacío.';
  if (!Number.isFinite(body.passengers) || body.passengers < 1 || body.passengers > 9)
    return 'Parámetros inválidos: passengers fuera de rango.';

  for (let i = 0; i < body.legs.length; i++) {
    const leg = body.legs[i];
    if (!isValidIATA(String(leg.origin ?? '')) || !isValidIATA(String(leg.destination ?? ''))) {
      return `IATA inválido en tramo ${i + 1}`;
    }
    if (!isValidDateYYYYMMDD(String(leg.departure_date ?? ''))) {
      return `Fecha inválida en tramo ${i + 1} (usa YYYY-MM-DD)`;
    }
  }

  const tr = body.filters?.departureTimeRange;
  if (tr) {
    if (!isValidHHMM(tr.from) || !isValidHHMM(tr.to)) return 'Rango horario inválido (usa HH:MM).';
  }

  return null;
}

async function getAirlineIdsByCodes(
  supabase: ReturnType<typeof createAdminClient>,
  airlineCodes: string[],
): Promise<{ ids: string[]; error?: string }> {
  const tryCols = ['iata_code', 'code'] as const;

  for (const col of tryCols) {
    const { data, error } = await supabase.from('airlines').select(`id, ${col}`).in(col, airlineCodes);

    if (!error) {
      const ids = (data ?? [])
        .map((a) => {
          const rec = a as unknown;
          if (!isRecord(rec)) return null;
          const id = rec.id;
          return id == null ? null : String(id);
        })
        .filter((x): x is string => Boolean(x));

      return { ids };
    }

    const msg = String((error as unknown as { message?: unknown }).message ?? '');
    if (!msg.includes(col)) return { ids: [], error: msg };
  }

  return { ids: [], error: 'No se pudo filtrar aerolíneas: error de esquema.' };
}

export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    // 1) RATE LIMIT (robusto, sin casting a interfaces)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const now = new Date();

    const { data: rlData } = await supabase
      .from('search_rate_limits')
      .select('ip_address,last_search_at,search_count')
      .eq('ip_address', ip)
      .maybeSingle();

    const rl = rlData as unknown;

    if (isRecord(rl) && isNonEmptyString(rl.last_search_at) && typeof rl.search_count === 'number') {
      const diffMs = now.getTime() - new Date(rl.last_search_at).getTime();

      if (rl.search_count >= 5 && diffMs < 30_000) {
        return NextResponse.json({ error: 'Demasiadas búsquedas. Intente de nuevo en breve.' }, { status: 429 });
      }

      const newCount = diffMs > 30_000 ? 1 : rl.search_count + 1;

      await supabase
        .from('search_rate_limits')
        .update({ last_search_at: now.toISOString(), search_count: newCount })
        .eq('ip_address', ip);
    } else {
      await supabase
        .from('search_rate_limits')
        .upsert({ ip_address: ip, last_search_at: now.toISOString(), search_count: 1 }, { onConflict: 'ip_address' });
    }

    // 2) Parse + normalize
    const raw = (await req.json()) as FlightSearchParams;
    const body = normalizeToRequest(raw);

    const validationErr = validateRequest(body);
    if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });

    const cache_key = makeCacheKey(body);
    const nowIso = new Date().toISOString();

    // 3) CACHE HIT
    const { data: cached } = await supabase
      .from('flight_search_cache')
      .select('response, expires_at')
      .eq('cache_key', cache_key)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (cached?.response) {
      console.info('[FLIGHTS_SEARCH] source=cache', { cache_key });

      const cachedResults: ResultsByLeg = Array.isArray(cached.response)
        ? (cached.response as unknown[])
            .filter(isRecord)
            .map((r) => ({
              legIndex: Number((r as FlightRecord).legIndex ?? 0),
              flights: Array.isArray((r as FlightRecord).flights)
                ? (((r as FlightRecord).flights as unknown[]).filter(isRecord) as FlightRecord[])
                : [],
            }))
        : [];

      const providersUsed = extractProvidersUsed(cachedResults);
      return NextResponse.json({ source: 'cache', providersUsed, results: cachedResults });
    }

    // 4) LIVE — Orchestrator
    let resultsByLeg: ResultsByLeg | null = null;
    let providersUsed: string[] = [];

    try {
      console.info('[FLIGHTS_SEARCH] source=live', { cache_key, provider: flightsOrchestrator.id });

      const providerRes = await flightsOrchestrator.search(body);

      resultsByLeg = providerRes.map((r) => ({
        legIndex: r.legIndex,
        flights: (r.flights as unknown[]).filter(isRecord) as FlightRecord[],
      }));

      providersUsed = extractProvidersUsed(resultsByLeg);
    } catch (e: unknown) {
      const msg = String(isRecord(e) ? e.message : e ?? '');
      if (msg.startsWith('IATA inválido')) return NextResponse.json({ error: msg }, { status: 400 });
      console.warn('[FLIGHTS_SEARCH] orchestrator error, fallback DB:', msg);
    }

    // 5) FALLBACK DB (mejor de luis: joins + stops flexible)
    if (!resultsByLeg) {
      // A) Resolver airports en 1 query
      const allIatas = Array.from(new Set(body.legs.flatMap((l) => [l.origin, l.destination])));

      const { data: airportsAll, error: airportsAllErr } = await supabase
        .from('airports')
        .select('id, iata_code')
        .in('iata_code', allIatas);

      if (airportsAllErr) return NextResponse.json({ error: airportsAllErr.message }, { status: 500 });

      const airportIdByIata = new Map<string, string>();
      for (const a of airportsAll ?? []) {
        const rec = a as unknown;
        if (!isRecord(rec)) continue;
        airportIdByIata.set(String(rec.iata_code), String(rec.id));
      }

      // B) Airline filter (resolve once)
      let airlineIdsFilter: string[] | null = null;
      if (body.filters?.airlineCodes?.length) {
        const { ids, error } = await getAirlineIdsByCodes(supabase, body.filters.airlineCodes);
        if (error) return NextResponse.json({ error }, { status: 500 });
        airlineIdsFilter = ids;

        if (!airlineIdsFilter.length) {
          const empty: ResultsByLeg = body.legs.map((_, i) => ({ legIndex: i, flights: [] }));
          return NextResponse.json({ source: 'live', providersUsed: ['legacy-db'], results: empty });
        }
      }

      const legacyResults: ResultsByLeg = [];

      for (let i = 0; i < body.legs.length; i++) {
        const leg = body.legs[i];

        const originId = airportIdByIata.get(leg.origin);
        const destinationId = airportIdByIata.get(leg.destination);

        if (!originId || !destinationId) {
          return NextResponse.json({ error: `IATA inválido en tramo ${i + 1}` }, { status: 400 });
        }

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

        if (body.filters?.minPrice != null) q = q.gte('final_price', body.filters.minPrice);
        if (body.filters?.maxPrice != null) q = q.lte('final_price', body.filters.maxPrice);
        if (airlineIdsFilter?.length) q = q.in('airline_id', airlineIdsFilter);

        const { data: flightsRaw, error: flightsErr } = await q;
        if (flightsErr) return NextResponse.json({ error: flightsErr.message }, { status: 500 });

        let flights: FlightRecord[] = (flightsRaw as unknown[]).filter(isRecord) as FlightRecord[];

        // maxStops: mejor de los 2 (stops array + varios nombres legacy)
        if (body.filters?.maxStops != null) {
          const maxStops = body.filters.maxStops;

          flights = flights.filter((f) => {
            const rawStops = f.stops;
            if (Array.isArray(rawStops)) return rawStops.length <= maxStops;

            let stops =
              readNumberField(f, 'stops_count') ??
              readNumberField(f, 'number_of_stops') ??
              readNumberField(f, 'stops') ??
              readNumberField(f, 'stop_count') ??
              readNumberField(f, 'segments_count');

            // segments_count -> segments-1 (si venía como segmentos)
            if (stops != null && (f.segments_count != null || f['segments_count'] != null)) {
              stops = Math.max(0, stops - 1);
            }

            if (stops == null) return true; // no evaluable, lo dejamos
            return stops <= maxStops;
          });
        }

        legacyResults.push({ legIndex: i, flights });
      }

      resultsByLeg = legacyResults;
      providersUsed = ['legacy-db'];
      console.info('[FLIGHTS_SEARCH] source=live', { cache_key, providersUsed });
    }

    const finalResults = resultsByLeg as ResultsByLeg;

    // 6) CACHE STORE
    const expires_at = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from('flight_search_cache')
      .upsert({ cache_key, response: finalResults, expires_at }, { onConflict: 'cache_key' });

    if (upsertErr) console.warn('flight_search_cache upsert error:', upsertErr.message);

    return NextResponse.json({ source: 'live', providersUsed, results: finalResults });
  } catch (err: unknown) {
    console.error('[FLIGHT_SEARCH_ERROR]', err);
    const msg = String(isRecord(err) ? err.message : err ?? 'Internal server error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
