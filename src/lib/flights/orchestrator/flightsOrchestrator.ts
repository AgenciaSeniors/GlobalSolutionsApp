/**
 * flightsOrchestrator — SkyScrapper-only orchestrator.
 *
 * v7 — Removed agency-inventory provider. All results come exclusively
 *      from the SkyScrapper/RapidAPI pipeline. Results are returned
 *      without slicing so the UI can apply a "Load More" pattern.
 */

import type {
  Flight,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "@/lib/flights/providers/types";
import { logger } from "@/lib/observability/logger";
import { skyScrapperProvider } from "@/lib/flights/providers/skyScrapperProvider";
import {
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/flights/orchestrator/providerCircuitBreaker";

/** Number of flights shown initially in the UI — frontend uses this as the first page size. */
export const INITIAL_DISPLAY_CAP = 20;
const EXTERNAL_TIMEOUT_MS = 40_000;

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
  const parsed = Date.parse(raw);
  return !Number.isNaN(parsed)
    ? new Date(parsed).toISOString().slice(0, 16)
    : raw;
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

export function flightDedupeKey(f: Flight): string {
  return `${normalizeAirlineCode(f)}|${normalizeFlightNumber(f)}|${getOriginIata(f)}|${getDestinationIata(f)}|${normalizeDepartureDatetime(f)}`;
}

/* -------------------------------------------------- */
/* ---- SORT + MERGE -------------------------------- */
/* -------------------------------------------------- */

function sortFlightsByPrice(a: Flight, b: Flight): number {
  // Exclusive offers always first
  if (a.is_exclusive_offer !== b.is_exclusive_offer)
    return a.is_exclusive_offer ? -1 : 1;

  const aRec = a as unknown as Record<string, unknown>;
  const bRec = b as unknown as Record<string, unknown>;

  const priceA = Number(aRec["final_price"] ?? a.price ?? 0);
  const priceB = Number(bRec["final_price"] ?? b.price ?? 0);
  if (priceA !== priceB) return priceA - priceB;

  const depA = Date.parse(safeString(a.departure_datetime)) || 0;
  const depB = Date.parse(safeString(b.departure_datetime)) || 0;
  return depA - depB;
}

function dedupeAndRank(flights: Flight[]): Flight[] {
  const bestByKey = new Map<string, Flight>();
  for (const f of flights) {
    const key = flightDedupeKey(f);
    const existing = bestByKey.get(key);
    if (!existing || sortFlightsByPrice(f, existing) < 0)
      bestByKey.set(key, f);
  }
  const result = Array.from(bestByKey.values());
  result.sort(sortFlightsByPrice);
  return result;
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
  id: "skyscrapper-orchestrator",

  async search(
    req: ProviderSearchRequest,
    opts?: { signal?: AbortSignal; allowExternal?: boolean }
  ): Promise<ProviderSearchResponse> {
    const t0 = Date.now();

    // ── SkyScrapper ──────────────────────────────────
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
              opts.signal.addEventListener("abort", onAbort, { once: true });
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

      const externalTotal = totalFlights(externalRes);
      console.log(
        `[Orchestrator] SkyScrapper: ${externalTotal} flights in ${Date.now() - t0}ms`
      );
    } catch (err: unknown) {
      console.warn(
        `[Orchestrator] SkyScrapper failed: ${err instanceof Error ? err.message : String(err)}`
      );
      await recordProviderFailure("sky-scrapper");
    }

    logger.info(
      { totalMs: Date.now() - t0 },
      "[Orchestrator] Search complete"
    );

    const externalByLeg = mapByLegIndex(externalRes);

    // Return ALL flights — no slice. The UI applies INITIAL_DISPLAY_CAP
    // and shows a "Load More" button for the rest.
    return req.legs.map((_, idx) => ({
      legIndex: idx,
      flights: dedupeAndRank(externalByLeg.get(idx) ?? []),
    }));
  },
};
