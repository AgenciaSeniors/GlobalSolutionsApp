/**
 * flightsOrchestrator — Agency-first orchestrator.
 *
 * v6 — Improvements:
 *   1. Cleaner logging with timing breakdowns
 *   2. Expose search metadata (timings, providers used)
 *   3. Improved type safety in sort/merge
 */

import type {
  Flight,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "@/lib/flights/providers/types";
import { logger } from "@/lib/observability/logger";
import { agencyInventoryProvider } from "@/lib/flights/providers/agencyInventoryProvider";
import { skyScrapperProvider } from "@/lib/flights/providers/skyScrapperProvider";
import {
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/flights/orchestrator/providerCircuitBreaker";

const TARGET_RESULTS_PER_LEG = 80;
const EXTERNAL_TIMEOUT_MS = 120_000;

/* -------------------------------------------------- */
/* ---- TYPE HELPERS -------------------------------- */
/* -------------------------------------------------- */

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
  for (const k of ["iata_code", "iata", "code"]) {
    const v = getFromRecord(airportLike, k);
    if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  }
  return null;
}

/* -------------------------------------------------- */
/* ---- DEDUPLICATION KEY BUILDERS ------------------ */
/* -------------------------------------------------- */

function normalizeDepartureDatetime(f: Flight): string {
  const raw = safeString(f.departure_datetime);
  if (!raw) return raw;

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    // If provider accidentally sent an ISO without offset, keep it (best-effort).
    return raw.length >= 16 ? raw.slice(0, 16) : raw;
  }

  // Always present departure time in Cuba timezone (America/Havana)
  const utcMillis = parsed;
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Havana",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = dtf.formatToParts(new Date(utcMillis));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function normalizeAirlineCode(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  const airline = rec["airline"];
  if (isRecord(airline)) {
    for (const k of ["iata_code", "code"]) {
      const v = airline[k];
      if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
    }
  }
  for (const k of ["airline_iata", "airline_code"]) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  }
  const fn = safeUpper(rec["flight_number"]);
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

function getOriginIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  if (
    typeof rec["origin_iata"] === "string" &&
    (rec["origin_iata"] as string).trim()
  )
    return (rec["origin_iata"] as string).trim().toUpperCase();
  return getAirportCode(rec["origin_airport"]) ?? "NORIG";
}

function getDestinationIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  if (
    typeof rec["destination_iata"] === "string" &&
    (rec["destination_iata"] as string).trim()
  )
    return (rec["destination_iata"] as string).trim().toUpperCase();
  return getAirportCode(rec["destination_airport"]) ?? "NDEST";
}

function normalizePrice(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  const p = Number(rec["final_price"] ?? rec["price"] ?? 0);
  return Number.isFinite(p) ? String(Math.round(p)) : "0";
}

export function flightDedupeKey(f: Flight): string {
  return `${normalizeAirlineCode(f)}|${normalizeFlightNumber(f)}|${getOriginIata(f)}|${getDestinationIata(f)}|${normalizeDepartureDatetime(f)}|${normalizePrice(f)}`;
}

/* -------------------------------------------------- */
/* ---- SORT + MERGE -------------------------------- */
/* -------------------------------------------------- */

function sortFlightsAgencyFirst(a: Flight, b: Flight): number {
  if (a.is_exclusive_offer !== b.is_exclusive_offer)
    return a.is_exclusive_offer ? -1 : 1;

  const sourcePriority: Record<string, number> = {
    agency: 1,
    "agency-inventory": 1,
    "sky-scrapper": 2,
    external: 2,
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

  const pA = sourcePriority[sourceA] ?? 99;
  const pB = sourcePriority[sourceB] ?? 99;
  if (pA !== pB) return pA - pB;

  const priceA = Number(aRec["final_price"] ?? a.price ?? 0);
  const priceB = Number(bRec["final_price"] ?? b.price ?? 0);
  if (priceA !== priceB) return priceA - priceB;

  const depA = Date.parse(safeString(a.departure_datetime)) || 0;
  const depB = Date.parse(safeString(b.departure_datetime)) || 0;
  return depA - depB;
}

function mergeDedupeAndRank(
  primary: Flight[],
  secondary: Flight[]
): Flight[] {
  const bestByKey = new Map<string, Flight>();
  const consider = (f: Flight) => {
    const key = flightDedupeKey(f);
    const existing = bestByKey.get(key);
    if (!existing || sortFlightsAgencyFirst(f, existing) < 0)
      bestByKey.set(key, f);
  };
  primary.forEach(consider);
  secondary.forEach(consider);
  const merged = Array.from(bestByKey.values());
  merged.sort(sortFlightsAgencyFirst);
  return merged;
}

/* -------------------------------------------------- */
/* ---- LEG MAPPERS --------------------------------- */
/* -------------------------------------------------- */

function mapByLegIndex(
  res: ProviderSearchResponse
): Map<number, Flight[]> {
  const map = new Map<number, Flight[]>();
  for (const item of res) map.set(item.legIndex, item.flights);
  return map;
}

function totalFlights(res: ProviderSearchResponse): number {
  return res.reduce((sum, r) => sum + r.flights.length, 0);
}

/* -------------------------------------------------- */
/* ---- ORCHESTRATOR -------------------------------- */
/* -------------------------------------------------- */

export const flightsOrchestrator = {
  id: "agency-first-orchestrator",

  async search(
    req: ProviderSearchRequest,
    opts?: { signal?: AbortSignal; allowExternal?: boolean }
  ): Promise<ProviderSearchResponse> {
    const t0 = Date.now();

    // ── 1. Agency (DB, fast) ─────────────────────────
    const agencyRes = await agencyInventoryProvider.search(req);
    const agencyByLeg = mapByLegIndex(agencyRes);
    const agencyMs = Date.now() - t0;
    const agencyTotal = totalFlights(agencyRes);
    console.log(
      `[Orchestrator] Agency: ${agencyTotal} flights in ${agencyMs}ms`
    );

    // ── 2. Need external? ────────────────────────────
    const needsExternal = req.legs.some(
      (_, idx) =>
        (agencyByLeg.get(idx) ?? []).length < TARGET_RESULTS_PER_LEG
    );

    if (!needsExternal) {
      logger.info({ metric: 'cache_hit_rate', status: 'agency_sufficient' }, 'Agency has enough results, skipping external');
      return req.legs.map((_, idx) => {
  const merged = mergeDedupeAndRank(
    agencyByLeg.get(idx) ?? [],
    externalByLeg.get(idx) ?? []
  );

  // 1️⃣ Agrupar por aerolínea para no perder diversidad
  const byCarrier = new Map<string, Flight[]>();

  for (const f of merged) {
    const carrier = normalizeAirlineCode(f);
    if (!byCarrier.has(carrier)) {
      byCarrier.set(carrier, []);
    }
    byCarrier.get(carrier)!.push(f);
  }

  // 2️⃣ Tomar hasta 3 vuelos por aerolínea (ajustable)
  const diversified: Flight[] = [];

  for (const flights of byCarrier.values()) {
    diversified.push(...flights.slice(0, 3));
  }

  // 3️⃣ Ordenar nuevamente
  diversified.sort(sortFlightsAgencyFirst);

  return {
    legIndex: idx,
    flights: diversified.slice(0, TARGET_RESULTS_PER_LEG),
  };
});
    }

    // ── 3. SkyScrapper ───────────────────────────────
    let externalRes: ProviderSearchResponse = [];
    try {
      const allowExternal = opts?.allowExternal !== false;
      if (!allowExternal) {
        console.log("[Orchestrator] External disabled by options");
      } else {
        const breaker = await isCircuitOpen("sky-scrapper");
        if (breaker.open) {
          console.warn(
            `[Orchestrator] SkyScrapper circuit OPEN until ${breaker.openUntil ?? "?"} — skipping external`
          );
        } else {
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            EXTERNAL_TIMEOUT_MS
          );

          const onAbort = () => controller.abort();
          if (opts?.signal) {
            if (opts.signal.aborted) controller.abort();
            else
              opts.signal.addEventListener("abort", onAbort, {
                once: true,
              });
          }

          try {
            externalRes = await skyScrapperProvider.search(req, {
              signal: controller.signal,
            });
            await recordProviderSuccess("sky-scrapper");
          } finally {
            clearTimeout(timer);
            if (opts?.signal) {
              try {
                opts.signal.removeEventListener("abort", onAbort);
              } catch {
                // ignore
              }
            }
          }
        }
      }

      const externalMs = Date.now() - t0 - agencyMs;
      const externalTotal = totalFlights(externalRes);
      console.log(
        `[Orchestrator] SkyScrapper: ${externalTotal} flights in ~${externalMs}ms`
      );
    } catch (err: unknown) {
      console.warn(
        `[Orchestrator] SkyScrapper failed: ${err instanceof Error ? err.message : String(err)}`
      );
      await recordProviderFailure("sky-scrapper");
    }

    const externalByLeg = mapByLegIndex(externalRes);
    console.log(
      `[Orchestrator] Total search time: ${Date.now() - t0}ms`
    );

    // ── 4. Merge + Rank ──────────────────────────────
    return req.legs.map((_, idx) => {
  const merged = mergeDedupeAndRank(
    agencyByLeg.get(idx) ?? [],
    externalByLeg.get(idx) ?? []
  );

  // 1️⃣ Agrupar por aerolínea para no perder diversidad
  const byCarrier = new Map<string, Flight[]>();

  for (const f of merged) {
    const carrier = normalizeAirlineCode(f);
    if (!byCarrier.has(carrier)) {
      byCarrier.set(carrier, []);
    }
    byCarrier.get(carrier)!.push(f);
  }

  // 2️⃣ Tomar hasta 3 vuelos por aerolínea (ajustable)
  const diversified: Flight[] = [];

  for (const flights of byCarrier.values()) {
    diversified.push(...flights.slice(0, 3));
  }

  // 3️⃣ Ordenar nuevamente
  diversified.sort(sortFlightsAgencyFirst);

  return {
    legIndex: idx,
    flights: diversified.slice(0, TARGET_RESULTS_PER_LEG),
  };
});
  },
};
