import type { FlightLeg, FlightSearchFilters } from '@/types/api.types';
import type { Flight, FlightsProvider, ProviderSearchRequest, ProviderSearchResponse } from './types';

function toUpperString(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function stableHash(input: string): number {
  // FNV-1a 32-bit (determinista)
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseHHMMToMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h * 60 + mm;
}

function chooseFrom<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

function buildDepartureTimeForLeg(
  leg: FlightLeg,
  filters: FlightSearchFilters | undefined,
  seed: number,
): { depISO: string; depMinutes: number } {
  // Defaults: 08:00..20:00
  const baseMin = 8 * 60;
  const baseMax = 20 * 60;

  let fromMin = baseMin;
  let toMin = baseMax;

  if (filters?.departureTimeRange?.from && filters?.departureTimeRange?.to) {
    const f = parseHHMMToMinutes(filters.departureTimeRange.from);
    const t = parseHHMMToMinutes(filters.departureTimeRange.to);
    if (f != null && t != null && f <= t) {
      fromMin = f;
      toMin = t;
    }
  }

  const span = Math.max(1, toMin - fromMin);
  const offset = seed % span;
  const depMinutes = fromMin + offset;

  const hh = Math.floor(depMinutes / 60);
  const mm = depMinutes % 60;

  const depISO = `${leg.departure_date}T${pad2(hh)}:${pad2(mm)}:00`;
  return { depISO, depMinutes };
}

function buildArrivalISO(departureISO: string, durationMinutes: number): string {
  // Stub: suma minutos (no TZ real)
  const dep = new Date(departureISO);
  const arr = new Date(dep.getTime() + durationMinutes * 60_000);
  return arr.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
}

function pickAirlineCodes(filters: FlightSearchFilters | undefined): string[] {
  const requested = filters?.airlineCodes?.map((c) => toUpperString(c)).filter(Boolean) ?? [];
  if (requested.length) return requested;

  return ['AA', 'DL', 'UA', 'LA', 'AV', 'IB'];
}

function buildPrice(filters: FlightSearchFilters | undefined, seed: number): number {
  const min = filters?.minPrice != null ? Number(filters.minPrice) : 120;
  const max = filters?.maxPrice != null ? Number(filters.maxPrice) : 1500;

  const safeMin = Number.isFinite(min) ? min : 120;
  const safeMax = Number.isFinite(max) ? max : 1500;

  const lo = Math.min(safeMin, safeMax);
  const hi = Math.max(safeMin, safeMax);

  const span = Math.max(1, hi - lo);
  const raw = lo + (seed % span);

  // múltiplos de 5
  return Math.round(raw / 5) * 5;
}

function makeOfferId(parts: string[]): string {
  const h = stableHash(parts.join('|')).toString(16);
  return `ext_${h}`;
}

function buildFlight(
  legIndex: number,
  leg: FlightLeg,
  filters: FlightSearchFilters | undefined,
  seedBase: number,
  offerIndex: number,
): Flight {
  const origin = toUpperString(leg.origin);
  const destination = toUpperString(leg.destination);

  const airlines = pickAirlineCodes(filters);
  const airlineCode = chooseFrom(airlines, seedBase + offerIndex);

  // stops: 0..2
  const stopsCandidate = (seedBase + offerIndex) % 3;

  // duration: 90..600
  const durationMinutes = 90 + ((seedBase >>> 3) + offerIndex * 37) % 510;

  const timeSeed = stableHash(`${seedBase}:${offerIndex}:${origin}:${destination}:${leg.departure_date}`);
  const { depISO } = buildDepartureTimeForLeg(leg, filters, timeSeed);

  const arrISO = buildArrivalISO(depISO, durationMinutes);

  const price = buildPrice(filters, stableHash(`${seedBase}:${offerIndex}:price`));

  const id = makeOfferId([String(legIndex), origin, destination, leg.departure_date, airlineCode, depISO, String(price)]);

  const flightNumber = `${airlineCode}${100 + ((seedBase + offerIndex * 13) % 900)}`;

  // ✅ Cumplimos el contrato: id, price, duration (y extras libres)
  return {
    id,
    price,
    duration: durationMinutes,

    offerSource: 'external-stub',
    provider: 'external-stub',
    legIndex,

    origin_iata: origin,
    destination_iata: destination,

    departure_datetime: depISO,
    arrival_datetime: arrISO,

    duration_minutes: durationMinutes,
    stops_count: stopsCandidate,

    currency: 'USD',
    final_price: price,

    airline: {
      code: airlineCode,
      name: `Airline ${airlineCode}`,
    },
    origin_airport: {
      iata_code: origin,
      name: `Airport ${origin}`,
    },
    destination_airport: {
      iata_code: destination,
      name: `Airport ${destination}`,
    },

    flight_number: flightNumber,
    available_seats: 9,
  };
}

function applyMaxStops(flights: Flight[], maxStops: number): Flight[] {
  return flights.filter((f) => {
    const v = f.stops_count;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return true;
    return n <= maxStops;
  });
}

export const externalStubProvider: FlightsProvider = {
  id: 'external-stub',

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const legs = req.legs ?? [];
    const filters = req.filters;

    const response: ProviderSearchResponse = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      const origin = toUpperString(leg.origin);
      const destination = toUpperString(leg.destination);
      const date = String(leg.departure_date ?? '').trim();

      if (!origin || !destination || !date) {
        response.push({ legIndex: i, flights: [] });
        continue;
      }

      const seed = stableHash(
        [
          'external-stub',
          origin,
          destination,
          date,
          String(req.passengers ?? 1),
          JSON.stringify(filters ?? {}),
        ].join('|'),
      );

      // 5..12 ofertas
      const count = 5 + (seed % 8);

      let flights: Flight[] = [];
      for (let k = 0; k < count; k++) {
        flights.push(buildFlight(i, leg, filters, seed, k));
      }

      // maxStops
      if (filters?.maxStops != null && Number.isFinite(Number(filters.maxStops))) {
        flights = applyMaxStops(flights, clamp(Number(filters.maxStops), 0, 3));
      }

      // ordenar por price asc
      flights.sort((a, b) => a.price - b.price);

      response.push({ legIndex: i, flights });
    }

    return response;
  },
};
