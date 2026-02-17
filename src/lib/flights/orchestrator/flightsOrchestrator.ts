/**
 * flightsOrchestrator — Agency-first orchestrator.
 *
 * v5 — Stub provider REMOVED. Only real results from:
 *   1. Agency inventory (Supabase DB)
 *   2. SkyScrapper (RapidAPI)
 */

import type {
  Flight,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "@/lib/flights/providers/types";

import { agencyInventoryProvider } from "@/lib/flights/providers/agencyInventoryProvider";
import { skyScrapperProvider } from "@/lib/flights/providers/skyScrapperProvider";
import {
  isCircuitOpen,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/lib/flights/orchestrator/providerCircuitBreaker";

const TARGET_RESULTS_PER_LEG = 20;
const EXTERNAL_TIMEOUT_MS = 40_000;

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

function normalizeDepartureDatetime(f: Flight): string {
  const raw = safeString(f.departure_datetime);
  const parsed = Date.parse(raw);
  return !Number.isNaN(parsed) ? new Date(parsed).toISOString().slice(0, 16) : raw;
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
  const raw = safeUpper((f as unknown as Record<string, unknown>)["flight_number"]);
  if (!raw) return "NFN";
  const match = raw.match(/(\d{1,5})/);
  return match?.[1] ?? raw;
}

function getOriginIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  if (typeof rec["origin_iata"] === "string" && (rec["origin_iata"] as string).trim())
    return (rec["origin_iata"] as string).trim().toUpperCase();
  return getAirportCode(rec["origin_airport"]) ?? "NORIG";
}

function getDestinationIata(f: Flight): string {
  const rec = f as unknown as Record<string, unknown>;
  if (typeof rec["destination_iata"] === "string" && (rec["destination_iata"] as string).trim())
    return (rec["destination_iata"] as string).trim().toUpperCase();
  return getAirportCode(rec["destination_airport"]) ?? "NDEST";
}

function flightDedupeKey(f: Flight): string {
  return `${normalizeAirlineCode(f)}|${normalizeFlightNumber(f)}|${getOriginIata(f)}|${getDestinationIata(f)}|${normalizeDepartureDatetime(f)}`;
}

function sortFlightsAgencyFirst(a: Flight, b: Flight): number {
  if (a.is_exclusive_offer !== b.is_exclusive_offer) return a.is_exclusive_offer ? -1 : 1;

  const sourcePriority: Record<string, number> = { agency: 1, "agency-inventory": 1, "sky-scrapper": 2, external: 2 };
  const aRec = a as unknown as Record<string, unknown>;
  const bRec = b as unknown as Record<string, unknown>;

  const sourceA = typeof aRec["offerSource"] === "string" ? aRec["offerSource"] : typeof aRec["provider"] === "string" ? aRec["provider"] : "external";
  const sourceB = typeof bRec["offerSource"] === "string" ? bRec["offerSource"] : typeof bRec["provider"] === "string" ? bRec["provider"] : "external";

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

function mergeDedupeAndRank(primary: Flight[], secondary: Flight[]): Flight[] {
  const bestByKey = new Map<string, Flight>();
  const consider = (f: Flight) => {
    const key = flightDedupeKey(f);
    const existing = bestByKey.get(key);
    if (!existing || sortFlightsAgencyFirst(f, existing) < 0) bestByKey.set(key, f);
  };
  primary.forEach(consider);
  secondary.forEach(consider);
  const merged = Array.from(bestByKey.values());
  merged.sort(sortFlightsAgencyFirst);
  return merged;
}

function mapByLegIndex(res: ProviderSearchResponse): Map<number, Flight[]> {
  const map = new Map<number, Flight[]>();
  for (const item of res) map.set(item.legIndex, item.flights);
  return map;
}

function totalFlights(res: ProviderSearchResponse): number {
  return res.reduce((sum, r) => sum + r.flights.length, 0);
}

export const flightsOrchestrator = {
  id: "agency-first-orchestrator",

  async search(
    req: ProviderSearchRequest,
    opts?: { signal?: AbortSignal; allowExternal?: boolean }
  ): Promise<ProviderSearchResponse> {
    const t0 = Date.now();

    // 1. Agency (DB, fast)
    const agencyRes = await agencyInventoryProvider.search(req);
    const agencyByLeg = mapByLegIndex(agencyRes);
    console.log(`[Orchestrator] Agency query completed in ${Date.now() - t0}ms`);

    // 2. Need external?
    const needsExternal = req.legs.some((_, idx) => (agencyByLeg.get(idx) ?? []).length < TARGET_RESULTS_PER_LEG);

    if (!needsExternal) {
      console.log("[Orchestrator] Agency has enough results, skipping external");
      return req.legs.map((_, idx) => ({
        legIndex: idx,
        flights: (agencyByLeg.get(idx) ?? []).sort(sortFlightsAgencyFirst).slice(0, TARGET_RESULTS_PER_LEG),
      }));
    }

    // 3. SkyScrapper (real flights only — no stub fallback)
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
          const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

          const onAbort = () => controller.abort();
          if (opts?.signal) {
            if (opts.signal.aborted) controller.abort();
            else opts.signal.addEventListener("abort", onAbort, { once: true });
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

      console.log(
        `[Orchestrator] SkyScrapper completed in ${Date.now() - t0}ms (${totalFlights(externalRes)} flights)`
      );
    } catch (err: unknown) {
      console.warn(
        `[Orchestrator] SkyScrapper failed: ${err instanceof Error ? err.message : String(err)}`
      );
      await recordProviderFailure("sky-scrapper");
    }

    const externalByLeg = mapByLegIndex(externalRes);
    console.log(`[Orchestrator] Total search time: ${Date.now() - t0}ms`);

    // 4. Merge + Rank
    return req.legs.map((_, idx) => ({
      legIndex: idx,
      flights: mergeDedupeAndRank(agencyByLeg.get(idx) ?? [], externalByLeg.get(idx) ?? []).slice(0, TARGET_RESULTS_PER_LEG),
    }));
  },
};