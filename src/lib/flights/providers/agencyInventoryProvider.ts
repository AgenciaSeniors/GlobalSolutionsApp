import { createAdminClient } from '@/lib/supabase/admin';
import type { FlightLeg, FlightSearchFilters } from '@/types/api.types';
import type { Flight, FlightsProvider, ProviderSearchRequest, ProviderSearchResponse } from './types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toUpperString(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function parseStopsCountFromStopsField(stops: unknown): number | null {
  if (!Array.isArray(stops)) return null;
  return stops.length;
}

function parseDurationMinutes(depISO: string, arrISO: string): number {
  const dep = new Date(depISO);
  const arr = new Date(arrISO);
  const diff = arr.getTime() - dep.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round(diff / 60000);
}

async function resolveAirportIdsByIata(
  supabase: SupabaseAdmin,
  legs: FlightLeg[],
): Promise<Map<string, string>> {
  const allIatas = uniq(legs.flatMap((l) => [toUpperString(l.origin), toUpperString(l.destination)]));
  const { data, error } = await supabase.from('airports').select('id, iata_code').in('iata_code', allIatas);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const rec = row as unknown;
    if (!isRecord(rec)) continue;
    const iata = rec.iata_code;
    const id = rec.id;
    if (iata != null && id != null) map.set(String(iata).toUpperCase(), String(id));
  }
  return map;
}

async function resolveAirlineIdsByIata(
  supabase: SupabaseAdmin,
  airlineCodes: string[],
): Promise<string[]> {
  const codes = uniq(airlineCodes.map((c) => toUpperString(c)).filter(Boolean));
  if (!codes.length) return [];

  const { data, error } = await supabase.from('airlines').select('id, iata_code').in('iata_code', codes);
  if (error) throw new Error(error.message);

  const ids: string[] = [];
  for (const row of data ?? []) {
    const rec = row as unknown;
    if (!isRecord(rec)) continue;
    const id = rec.id;
    if (id != null) ids.push(String(id));
  }
  return ids;
}

export const agencyInventoryProvider: FlightsProvider = {
  id: 'agency-inventory',

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const supabase = createAdminClient();

    const legs = (req.legs ?? []).map((l) => ({
      origin: toUpperString(l.origin),
      destination: toUpperString(l.destination),
      departure_date: String(l.departure_date ?? '').trim(),
    }));

    const filters: FlightSearchFilters | undefined = req.filters;

    const airportIdByIata = await resolveAirportIdsByIata(supabase, legs);

    // airline filter
    let airlineIdsFilter: string[] | null = null;
    if (filters?.airlineCodes?.length) {
      airlineIdsFilter = await resolveAirlineIdsByIata(supabase, filters.airlineCodes);
      if (!airlineIdsFilter.length) {
        return legs.map((_, i) => ({ legIndex: i, flights: [] }));
      }
    }

    const results: ProviderSearchResponse = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      const originId = airportIdByIata.get(leg.origin);
      const destinationId = airportIdByIata.get(leg.destination);

      if (!originId || !destinationId) {
        throw new Error(`IATA inválido en tramo ${i + 1}`);
      }

      // Day window
      let start = `${leg.departure_date}T00:00:00`;
      let end = `${leg.departure_date}T23:59:59`;

      // Optional time range
      if (filters?.departureTimeRange?.from && filters?.departureTimeRange?.to) {
        start = `${leg.departure_date}T${filters.departureTimeRange.from}:00`;
        end = `${leg.departure_date}T${filters.departureTimeRange.to}:00`;
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
        .order('is_exclusive_offer', { ascending: false }) // exclusivas primero
        .order('final_price', { ascending: true }); // luego por precio

      // Price filters
      if (filters?.minPrice != null) q = q.gte('final_price', filters.minPrice);
      if (filters?.maxPrice != null) q = q.lte('final_price', filters.maxPrice);

      // Airline filter
      if (airlineIdsFilter?.length) q = q.in('airline_id', airlineIdsFilter);

      const { data: flightsRaw, error } = await q;
      if (error) throw new Error(error.message);

      let flights: Flight[] = (flightsRaw ?? [])
        .map((row) => {
          const rec = row as unknown;
          if (!isRecord(rec)) return null;

          const id = rec.id != null ? String(rec.id) : '';
          const finalPriceNum = rec.final_price != null ? Number(rec.final_price) : NaN;

          const dep = rec.departure_datetime != null ? String(rec.departure_datetime) : '';
          const arr = rec.arrival_datetime != null ? String(rec.arrival_datetime) : '';

          const duration = dep && arr ? parseDurationMinutes(dep, arr) : 0;

          // Contrato provider:
          const base: Flight = {
            id,
            price: Number.isFinite(finalPriceNum) ? finalPriceNum : 0,
            duration,
          };

          // Enriquecemos con campos DB + marca de agencia
          return {
            ...base,
            ...rec,
            offerSource: 'agency',
            provider: 'agency-inventory',
          } as Flight;
        })
        .filter((x): x is Flight => Boolean(x && x.id));

      // maxStops en base a flights.stops (jsonb array)
      if (filters?.maxStops != null && Number.isFinite(Number(filters.maxStops))) {
        const maxStops = clamp(Number(filters.maxStops), 0, 3);
        flights = flights.filter((f) => {
          const stopsCount = parseStopsCountFromStopsField((f as unknown as Record<string, unknown>).stops);
          if (stopsCount == null) return true;
          return stopsCount <= maxStops;
        });
      }

      results.push({ legIndex: i, flights });
    }

    return results;
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
