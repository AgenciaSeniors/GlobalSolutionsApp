import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightLeg } from '@/types/api.types';
import type { FlightsProvider, ProviderSearchRequest, ProviderSearchResponse } from './types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface AirlineRow {
  id: string;
  [key: string]: unknown;
}

interface FlightRow {
  stops_count?: number;
  number_of_stops?: number;
  stops?: number;
  stop_count?: number;
  segments_count?: number;
  [key: string]: unknown;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normIata(iata: string) {
  return String(iata ?? '').trim().toUpperCase();
}

async function resolveAirportIdsByIata(
  supabase: SupabaseAdmin,
  legs: FlightLeg[],
): Promise<Map<string, string>> {
  const allIatas = uniq(legs.flatMap((l) => [normIata(l.origin), normIata(l.destination)]));
  const { data, error } = await supabase.from('airports').select('id, iata_code').in('iata_code', allIatas);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const a of data ?? []) {
    if (a?.iata_code && a?.id) map.set(String(a.iata_code).toUpperCase(), String(a.id));
  }
  return map;
}

async function getAirlineIdsByCodes(
  supabase: SupabaseAdmin,
  airlineCodes: string[],
): Promise<string[]> {
  const codes = uniq(airlineCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
  if (!codes.length) return [];

  // Try common column names: iata_code first, then code.
  const tryCols = ['iata_code', 'code'] as const;

  for (const col of tryCols) {
    const { data, error } = await supabase.from('airlines').select(`id, ${col}`).in(col, codes);
    if (!error) return (data ?? []).map((a: AirlineRow) => String(a.id));

    // If the column doesn't exist, try next. Otherwise stop and surface the error.
    const msg = String(error?.message ?? '');
    if (!msg.includes(col)) throw new Error(msg);
  }

  throw new Error('No se pudo filtrar aerolíneas: falta columna iata_code/code en airlines.');
}

function bestEffortStops(f: FlightRow): number | null {
  let stops: number | undefined = f?.stops_count ?? f?.number_of_stops ?? f?.stops ?? f?.stop_count;
  if (stops == null && f?.segments_count != null) {
    stops = Math.max(0, Number(f.segments_count) - 1);
  }
  const n = Number(stops);
  if (stops == null || Number.isNaN(n)) return null;
  return n;
}

/**
 * Provider basado en la DB seed (tabla `flights` + joins) con filtros.
 * Útil como baseline y fallback mientras integramos proveedores externos.
 */
export const seedDbProvider: FlightsProvider = {
  id: 'seed-db',

  async search(req: ProviderSearchRequest, _opts?: { signal?: AbortSignal }): Promise<ProviderSearchResponse> {
    const supabase = createAdminClient();

    const legs = (req.legs ?? []).map((l) => ({
      origin: normIata(l.origin),
      destination: normIata(l.destination),
      departure_date: String(l.departure_date ?? '').trim(),
    }));

    const airportIdByIata = await resolveAirportIdsByIata(supabase, legs);

    // Airline filter (resolve once)
    let airlineIdsFilter: string[] | null = null;
    if (req.filters?.airlineCodes?.length) {
      airlineIdsFilter = await getAirlineIdsByCodes(supabase, req.filters.airlineCodes);

      // If user asked for airlines and none exist, return empty quickly
      if (!airlineIdsFilter.length) {
        return legs.map((_, i) => ({ legIndex: i, flights: [] }));
      }
    }

    const resultsByLeg: ProviderSearchResponse = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      const originId = airportIdByIata.get(leg.origin);
      const destinationId = airportIdByIata.get(leg.destination);

      if (!originId || !destinationId) {
        // Mantener el mismo comportamiento del endpoint: 400 "IATA inválido".
        // El route puede decidir cómo mapear este error.
        throw new Error(`IATA inválido en tramo ${i + 1}`);
      }

      // Date window (full day) or narrowed by time range (validated at route level)
      let start = `${leg.departure_date}T00:00:00`;
      let end = `${leg.departure_date}T23:59:59`;

      if (req.filters?.departureTimeRange?.from && req.filters?.departureTimeRange?.to) {
        start = `${leg.departure_date}T${req.filters.departureTimeRange.from}:00`;
        end = `${leg.departure_date}T${req.filters.departureTimeRange.to}:00`;
      }

      let q = supabase
        .from('flights')
        .select(
  `
  *,
  stops,  
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
      if (req.filters?.minPrice != null) q = q.gte('final_price', req.filters.minPrice);
      if (req.filters?.maxPrice != null) q = q.lte('final_price', req.filters.maxPrice);

      // Airline filter (SQL)
      if (airlineIdsFilter?.length) q = q.in('airline_id', airlineIdsFilter);

      const { data: flightsRaw, error } = await q;
      if (error) throw new Error(error.message);

      let flights = flightsRaw ?? [];

      // maxStops (best-effort in-memory)
      if (req.filters?.maxStops != null) {
        const maxStops = Number(req.filters.maxStops);
        flights = flights.filter((f) => {
          const stops = bestEffortStops(f);
          if (stops == null) return true; // can't evaluate; keep
          return stops <= maxStops;
        });
      }

      resultsByLeg.push({ legIndex: i, flights });
    }

    return resultsByLeg;
  },
};
