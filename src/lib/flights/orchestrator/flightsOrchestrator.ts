import type { Flight } from '@/lib/flights/providers/types';
import type { ProviderSearchRequest, ProviderSearchResponse } from '@/lib/flights/providers/types';
import { agencyInventoryProvider } from '@/lib/flights/providers/agencyInventoryProvider';
import { duffelProvider } from '@/lib/flights/providers/duffel.provider';
import { externalStubProvider } from '@/lib/flights/providers/externalStubProvider';

const TARGET_RESULTS_PER_LEG = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
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

function normalizeAirlineCode(f: Flight): string {
  const rec = f as Record<string, unknown>;

  const code =
    getNestedString(rec.airline, ['iata_code']) ??
    getNestedString(rec.airline, ['code']) ??
    getString(rec.airline_iata) ??
    getString(rec.airline_code) ??
    null;

  if (code) return code.trim().toUpperCase();

  // fallback: extraer prefijo de flight_number (ej: "AA123")
  const fn = getString(rec.flight_number);
  if (fn) {
    const m = fn.trim().toUpperCase().match(/^([A-Z]{2,3})\s*\d+/);
    if (m?.[1]) return m[1];
  }

  return 'NAIR';
}

function normalizeFlightNumber(f: Flight): string {
  const rec = f as Record<string, unknown>;
  const raw = getString(rec.flight_number) ?? 'NFN';

  // nos quedamos con el número: "AA 0123" -> "123"
  const m = raw.trim().toUpperCase().match(/(\d{1,5})/);
  if (!m?.[1]) return raw.trim().toUpperCase();

  const num = String(Number(m[1])); // quita ceros a la izquierda
  return num === 'NaN' ? m[1] : num;
}

function normalizeIata(s: string | null): string {
  return (s ?? 'NXXX').trim().toUpperCase();
}

function normalizeDepartureDatetime(f: Flight): string {
  const rec = f as Record<string, unknown>;
  const raw = getString(rec.departure_datetime) ?? 'NDEP';

  // Si parsea, normalizamos a ISO en precisión minuto
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    return new Date(t).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  }

  return raw.trim();
}

function flightDedupeKey(f: Flight): string {
  const rec = f as Record<string, unknown>;

  const airline = normalizeAirlineCode(f);
  const flightNumber = normalizeFlightNumber(f);

  const origin =
    getNestedString(rec.origin_airport, ['iata_code']) ??
    getString(rec.origin_iata) ??
    'NORIG';

  const dest =
    getNestedString(rec.destination_airport, ['iata_code']) ??
    getString(rec.destination_iata) ??
    'NDEST';

  const dep = normalizeDepartureDatetime(f);

  return `${airline}|${flightNumber}|${normalizeIata(origin)}|${normalizeIata(dest)}|${dep}`;
}


function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}


function sortFlightsAgencyFirst(a: Flight, b: Flight): number {
  // 1️⃣ Exclusivas primero
  if (a.is_exclusive_offer !== b.is_exclusive_offer) {
    return a.is_exclusive_offer ? -1 : 1;
  }

  // 2️⃣ Prioridad por source (agency < external)
  const SOURCE_PRIORITY: Record<string, number> = {
    agency: 1,
    'agency-inventory': 1,
    external: 2,
    'external-stub': 2,
  };

  const sourceA = asString(a.offerSource) || asString(a.provider) || 'external';
  const sourceB = asString(b.offerSource) || asString(b.provider) || 'external';

  const sa = SOURCE_PRIORITY[sourceA] ?? 99;
  const sb = SOURCE_PRIORITY[sourceB] ?? 99;
  if (sa !== sb) return sa - sb;

  // 3️⃣ Precio ascendente
  const pa = Number(a.final_price ?? a.price ?? 0);
  const pb = Number(b.final_price ?? b.price ?? 0);
  if (pa !== pb) return pa - pb;

  // 4️⃣ Hora de salida ascendente
  const da = Date.parse(asString(a.departure_datetime)) || 0;
  const db = Date.parse(asString(b.departure_datetime)) || 0;
  if (da !== db) return da - db;

  // 5️⃣ Desempate determinístico final
  const ka = `${asString(a.provider)}:${asString(a.id)}`;
  const kb = `${asString(b.provider)}:${asString(b.id)}`;
  return ka.localeCompare(kb);
}


function mapByLegIndex(res: ProviderSearchResponse): Map<number, Flight[]> {
  const m = new Map<number, Flight[]>();
  for (const item of res) {
    m.set(item.legIndex, item.flights);
  }
  return m;
}

function mergeDedupeAndRank(primary: Flight[], secondary: Flight[]): Flight[] {
  const bestByKey = new Map<string, Flight>();

  const consider = (f: Flight) => {
    const key = flightDedupeKey(f);
    const existing = bestByKey.get(key);

    if (!existing) {
      bestByKey.set(key, f);
      return;
    }

    // Si el nuevo es mejor que el existente según el ranking final, lo reemplaza
    if (sortFlightsAgencyFirst(f, existing) < 0) {
      bestByKey.set(key, f);
    }
  };

  for (const f of primary) consider(f);
  for (const f of secondary) consider(f);

  const merged = Array.from(bestByKey.values());
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

  console.log('🚀 [ORCHESTRATOR] Necesita búsqueda externa, llamando a Duffel...');

let externalRes: ProviderSearchResponse;

try {
  externalRes = await duffelProvider.search(req);
  console.log('✅ [ORCHESTRATOR] Duffel respondió. Tramos:', externalRes.length);
  externalRes.forEach((leg, idx) => {
    console.log(`   Tramo ${idx}: ${leg.flights.length} vuelos`);
  });
} catch (e) {
  console.error('❌ [ORCHESTRATOR] Duffel falló:', e);
  console.log('⚠️ [ORCHESTRATOR] Usando stub provider como fallback');
  externalRes = await externalStubProvider.search(req);
}

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
