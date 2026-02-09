import type { Flight } from '@/lib/flights/providers/types';
import type { ProviderSearchRequest, ProviderSearchResponse } from '@/lib/flights/providers/types';
import { agencyInventoryProvider } from '@/lib/flights/providers/agencyInventoryProvider';
import { externalStubProvider } from '@/lib/flights/providers/externalStubProvider';

const TARGET_RESULTS_PER_LEG = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getBool(v: unknown): boolean {
  return v === true;
}

function getNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function getNestedString(obj: unknown, path: string[]): string | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return null;
    cur = cur[key];
  }
  return getString(cur);
}

function flightDedupeKey(f: Flight): string {
  // Intentamos crear una key lo más estable posible entre DB y externos.
  // Preferencias:
  // - flight_number
  // - airline_id o airline.iata_code
  // - origin/destination (por airports join o campos directos)
  // - departure_datetime
  // Si falta algo, igual generamos key con lo que haya.

  const flightNumber = getString((f as Record<string, unknown>).flight_number) ?? 'NFN';
  const dep = getString((f as Record<string, unknown>).departure_datetime) ?? 'NDEP';

  const airlineId = getString((f as Record<string, unknown>).airline_id);
  const airlineIata =
    getNestedString((f as Record<string, unknown>).airline, ['iata_code']) ??
    getNestedString((f as Record<string, unknown>).airline, ['code']);

  const airlinePart = airlineId ?? airlineIata ?? 'NAIR';

  const origin =
    getNestedString((f as Record<string, unknown>).origin_airport, ['iata_code']) ??
    getString((f as Record<string, unknown>).origin_iata) ??
    'NORIG';

  const dest =
    getNestedString((f as Record<string, unknown>).destination_airport, ['iata_code']) ??
    getString((f as Record<string, unknown>).destination_iata) ??
    'NDEST';

  return `${flightNumber}|${airlinePart}|${origin}|${dest}|${dep}`;
}

function rankScore(f: Flight): { tier: number; price: number } {
  const rec = f as Record<string, unknown>;

  // 0 = mejor
  // Exclusivas de agencia primero
  const exclusive = getBool(rec.is_exclusive_offer);

  // También permitimos offerSource='agency' como señal
  const offerSource = getString(rec.offerSource) ?? '';
  const isAgency = offerSource === 'agency';

  // tier: exclusivas primero, luego agency, luego resto
  const tier = exclusive ? 0 : isAgency ? 1 : 2;

  const p = getNumber(rec.price) ?? getNumber(rec.final_price) ?? 0;

  return { tier, price: p };
}

function sortFlightsAgencyFirst(a: Flight, b: Flight): number {
  const ra = rankScore(a);
  const rb = rankScore(b);

  if (ra.tier !== rb.tier) return ra.tier - rb.tier;

  // precio asc
  if (ra.price !== rb.price) return ra.price - rb.price;

  // desempate estable
  return String(a.id).localeCompare(String(b.id));
}

function mapByLegIndex(res: ProviderSearchResponse): Map<number, Flight[]> {
  const m = new Map<number, Flight[]>();
  for (const item of res) {
    m.set(item.legIndex, item.flights);
  }
  return m;
}

function mergeDedupeAndRank(primary: Flight[], secondary: Flight[]): Flight[] {
  const seen = new Set<string>();
  const merged: Flight[] = [];

  const pushUnique = (f: Flight) => {
    const key = flightDedupeKey(f);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(f);
  };

  for (const f of primary) pushUnique(f);
  for (const f of secondary) pushUnique(f);

  merged.sort(sortFlightsAgencyFirst);
  return merged;
}

function takeTopN(arr: Flight[], n: number): Flight[] {
  if (arr.length <= n) return arr;
  return arr.slice(0, n);
}

export const flightsOrchestrator = {
  id: 'agency-first-orchestrator',

  /**
   * Strategy:
   * 1) Buscar agencia (DB) para todos los legs
   * 2) Si algún leg queda con menos de TARGET_RESULTS_PER_LEG, buscar externo
   * 3) Merge + dedupe + rank por leg
   */
  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const agencyRes = await agencyInventoryProvider.search(req);
    const agencyByLeg = mapByLegIndex(agencyRes);

    // Chequear si necesitamos externo
    const needsExternal = req.legs.some((_, idx) => {
      const cur = agencyByLeg.get(idx) ?? [];
      return cur.length < TARGET_RESULTS_PER_LEG;
    });

    if (!needsExternal) {
      // Igual rankeamos por si la DB no venía ordenada como queremos
      const ranked: ProviderSearchResponse = req.legs.map((_, idx) => {
        const flights = (agencyByLeg.get(idx) ?? []).slice().sort(sortFlightsAgencyFirst);
        return { legIndex: idx, flights: takeTopN(flights, TARGET_RESULTS_PER_LEG) };
      });
      return ranked;
    }

    const externalRes = await externalStubProvider.search(req);
    const externalByLeg = mapByLegIndex(externalRes);

    const final: ProviderSearchResponse = req.legs.map((_, idx) => {
      const agencyFlights = agencyByLeg.get(idx) ?? [];
      const externalFlights = externalByLeg.get(idx) ?? [];

      const merged = mergeDedupeAndRank(agencyFlights, externalFlights);
      return { legIndex: idx, flights: takeTopN(merged, TARGET_RESULTS_PER_LEG) };
    });

    return final;
  },
};
