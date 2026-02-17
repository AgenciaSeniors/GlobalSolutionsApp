/**
 * flightsOrchestrator — Agency-first orchestrator con protección de latencia.
 *
 * v3 — Cambios:
 *  1. External timeout subido a 30s (legs ahora tienen 25s de budget)
 *  2. Logging mejorado con timing por fase
 *  3. Si SkyScrapper devuelve 0 flights, degrada a stub
 */

import type {
  Flight,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "@/lib/flights/providers/types";

import { agencyInventoryProvider } from "@/lib/flights/providers/agencyInventoryProvider";
import { externalStubProvider } from "@/lib/flights/providers/externalStubProvider";
import { skyScrapperProvider } from "@/lib/flights/providers/skyScrapperProvider";

const TARGET_RESULTS_PER_LEG = 20;

/** Safety net: máximo tiempo total que el orchestrator espera por external */
const EXTERNAL_TIMEOUT_MS = 30_000;

/* ===========================
   Helpers seguros (sin any)
=========================== */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeUpper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function getFromRecord(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function getAirportCode(airportLike: unknown): string | null {
  if (typeof airportLike === "string") {
    const s = airportLike.trim().toUpperCase();
    return s.length ? s : null;
  }

  if (!isRecord(airportLike)) return null;

  const iataCode = getFromRecord(airportLike, "iata_code");
  if (typeof iataCode === "string" && iataCode.trim())
    return iataCode.trim().toUpperCase();

  const iata = getFromRecord(airportLike, "iata");
  if (typeof iata === "string" && iata.trim())
    return iata.trim().toUpperCase();

  const code = getFromRecord(airportLike, "code");
  if (typeof code === "string" && code.trim())
    return code.trim().toUpperCase();

  return null;
}

function normalizeDepartureDatetime(f: Flight): string {
  const raw = safeString(f.departure_datetime);
  const parsed = Date.parse(raw);

  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 16);
  }

  return raw;
}

function normalizeAirlineCode(f: Flight): string {
  const airlineUnknown: unknown = (f as unknown as Record<string, unknown>)[
    "airline"
  ];

  if (isRecord(airlineUnknown)) {
    const iataCode = airlineUnknown["iata_code"];
    if (typeof iataCode === "string" && iataCode.trim())
      return iataCode.trim().toUpperCase();

    const code = airlineUnknown["code"];
    if (typeof code === "string" && code.trim())
      return code.trim().toUpperCase();
  }

  const airlineIata = (f as unknown as Record<string, unknown>)[
    "airline_iata"
  ];
  if (typeof airlineIata === "string" && airlineIata.trim())
    return airlineIata.trim().toUpperCase();

  const airlineCode = (f as unknown as Record<string, unknown>)[
    "airline_code"
  ];
  if (typeof airlineCode === "string" && airlineCode.trim())
    return airlineCode.trim().toUpperCase();

  const fn = safeUpper(
    (f as unknown as Record<string, unknown>)["flight_number"]
  );
  if (fn) {
    const match = fn.match(/^([A-Z]{2,3})\s*\d+/);
    if (match?.[1]) return match[1];
  }

  return "NAIR";
}

function normalizeFlightNumber(f: Flight): string {
  const raw = safeUpper(
    (f as unknown as Record<string, unknown>)["flight_number"]
  );
  if (!raw) return "NFN";
  const match = raw.match(/(\d{1,5})/);
  return match?.[1] ?? raw;
}

function normalizeIata(code: string | null): string {
  return (code ?? "NXXX").trim().toUpperCase();
}

function getOriginIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;

  const originIata = rec["origin_iata"];
  if (typeof originIata === "string" && originIata.trim())
    return originIata.trim().toUpperCase();

  const originAirport = rec["origin_airport"];
  const fromAirport = getAirportCode(originAirport);
  if (fromAirport) return fromAirport;

  return "NORIG";
}

function getDestinationIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;

  const destIata = rec["destination_iata"];
  if (typeof destIata === "string" && destIata.trim())
    return destIata.trim().toUpperCase();

  const destAirport = rec["destination_airport"];
  const fromAirport = getAirportCode(destAirport);
  if (fromAirport) return fromAirport;

  return "NDEST";
}

function flightDedupeKey(f: Flight): string {
  const airline = normalizeAirlineCode(f);
  const flightNumber = normalizeFlightNumber(f);

  const origin = getOriginIata(f);
  const destination = getDestinationIata(f);

  const departure = normalizeDepartureDatetime(f);

  return `${airline}|${flightNumber}|${normalizeIata(origin)}|${normalizeIata(
    destination
  )}|${departure}`;
}

/* ===========================
   Ranking
=========================== */

function sortFlightsAgencyFirst(a: Flight, b: Flight): number {
  if (a.is_exclusive_offer !== b.is_exclusive_offer) {
    return a.is_exclusive_offer ? -1 : 1;
  }

  const sourcePriority: Record<string, number> = {
    agency: 1,
    "agency-inventory": 1,
    "sky-scrapper": 2,
    external: 2,
    "external-stub": 3,
  };

  const aRec = a as unknown as Record<string, unknown>;
  const bRec = b as unknown as Record<string, unknown>;

  const sourceA =
    typeof aRec["offerSource"] === "string"
      ? aRec["offerSource"]
      : typeof aRec["provider"] === "string"
      ? aRec["provider"]
      : "external";

  const sourceB =
    typeof bRec["offerSource"] === "string"
      ? bRec["offerSource"]
      : typeof bRec["provider"] === "string"
      ? bRec["provider"]
      : "external";

  const priorityA = sourcePriority[sourceA] ?? 99;
  const priorityB = sourcePriority[sourceB] ?? 99;
  if (priorityA !== priorityB) return priorityA - priorityB;

  const priceA = Number(
    (a as unknown as Record<string, unknown>)["final_price"] ?? a.price ?? 0
  );
  const priceB = Number(
    (b as unknown as Record<string, unknown>)["final_price"] ?? b.price ?? 0
  );
  if (priceA !== priceB) return priceA - priceB;

  const depA = Date.parse(safeString(a.departure_datetime)) || 0;
  const depB = Date.parse(safeString(b.departure_datetime)) || 0;
  if (depA !== depB) return depA - depB;

  const aId = safeString((a as unknown as Record<string, unknown>)["id"]);
  const bId = safeString((b as unknown as Record<string, unknown>)["id"]);
  const aProv = safeString(
    (a as unknown as Record<string, unknown>)["provider"]
  );
  const bProv = safeString(
    (b as unknown as Record<string, unknown>)["provider"]
  );

  return `${aProv}:${aId}`.localeCompare(`${bProv}:${bId}`);
}

/* ===========================
   Merge + Dedupe
=========================== */

function mergeDedupeAndRank(
  primary: Flight[],
  secondary: Flight[]
): Flight[] {
  const bestByKey = new Map<string, Flight>();

  const consider = (f: Flight) => {
    const key = flightDedupeKey(f);
    const existing = bestByKey.get(key);

    if (!existing) {
      bestByKey.set(key, f);
      return;
    }

    if (sortFlightsAgencyFirst(f, existing) < 0) {
      bestByKey.set(key, f);
    }
  };

  primary.forEach(consider);
  secondary.forEach(consider);

  const merged = Array.from(bestByKey.values());
  merged.sort(sortFlightsAgencyFirst);
  return merged;
}

function takeTopN(arr: Flight[], n: number): Flight[] {
  return arr.length <= n ? arr : arr.slice(0, n);
}

function mapByLegIndex(res: ProviderSearchResponse): Map<number, Flight[]> {
  const map = new Map<number, Flight[]>();
  for (const item of res) {
    map.set(item.legIndex, item.flights);
  }
  return map;
}

function totalFlights(res: ProviderSearchResponse): number {
  return res.reduce((sum, r) => sum + r.flights.length, 0);
}

/* ===========================
   Orchestrator
=========================== */

export const flightsOrchestrator = {
  id: "agency-first-orchestrator",

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const t0 = Date.now();

    // ── 1. Agency (DB local, rápido) ──
    const agencyRes = await agencyInventoryProvider.search(req);
    const agencyByLeg = mapByLegIndex(agencyRes);

    const agencyMs = Date.now() - t0;
    console.log(`[Orchestrator] Agency query completed in ${agencyMs}ms`);

    // ── 2. ¿Necesitamos resultados externos? ──
    const needsExternal = req.legs.some((_, idx) => {
      const flights = agencyByLeg.get(idx) ?? [];
      return flights.length < TARGET_RESULTS_PER_LEG;
    });

    if (!needsExternal) {
      console.log(
        "[Orchestrator] Agency has enough results, skipping external"
      );
      return req.legs.map((_, idx) => {
        const ranked = (agencyByLeg.get(idx) ?? [])
          .slice()
          .sort(sortFlightsAgencyFirst);
        return {
          legIndex: idx,
          flights: takeTopN(ranked, TARGET_RESULTS_PER_LEG),
        };
      });
    }

    // ── 3. External con safety net timeout ──
    let externalRes: ProviderSearchResponse = [];

    try {
      externalRes = await Promise.race([
        skyScrapperProvider.search(req),
        new Promise<ProviderSearchResponse>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `External provider timeout after ${EXTERNAL_TIMEOUT_MS}ms`
                )
              ),
            EXTERNAL_TIMEOUT_MS
          )
        ),
      ]);

      const extMs = Date.now() - t0 - agencyMs;
      const extFlights = totalFlights(externalRes);
      console.log(
        `[Orchestrator] SkyScrapper completed in ${extMs}ms (${extFlights} flights)`
      );

      // Si SkyScrapper devolvió 0 vuelos, complementar con stub
      if (extFlights === 0) {
        console.log(
          "[Orchestrator] SkyScrapper returned 0 flights, supplementing with stub"
        );
        try {
          const stubRes = await externalStubProvider.search(req);
          externalRes = stubRes;
        } catch {
          // stub failed too, proceed with empty
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Orchestrator] SkyScrapper failed: ${msg}`);

      try {
        externalRes = await externalStubProvider.search(req);
        console.log("[Orchestrator] Fell back to stub provider");
      } catch (stubErr: unknown) {
        const stubMsg =
          stubErr instanceof Error ? stubErr.message : String(stubErr);
        console.error(`[Orchestrator] Stub also failed: ${stubMsg}`);
      }
    }

    const externalByLeg = mapByLegIndex(externalRes);

    // ── 4. Merge + Rank ──
    const totalMs = Date.now() - t0;
    console.log(`[Orchestrator] Total search time: ${totalMs}ms`);

    return req.legs.map((_, idx) => {
      const agencyFlights = agencyByLeg.get(idx) ?? [];
      const externalFlights = externalByLeg.get(idx) ?? [];

      const merged = mergeDedupeAndRank(agencyFlights, externalFlights);
      return {
        legIndex: idx,
        flights: takeTopN(merged, TARGET_RESULTS_PER_LEG),
      };
    });
  },
};