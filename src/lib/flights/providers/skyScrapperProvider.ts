/**
 * skyScrapperProvider — Provider de vuelos vía RapidAPI SkyScrapper.
 *
 * v6 — Fixes:
 *  1. In-memory cache for resolved place IDs (avoids repeated auto-complete calls)
 *  2. Fallback from /flights/auto-complete to /api/v1/flights/searchAirport
 *  3. Increased auto-complete timeout to 15s
 *  4. Fully typed (zero any)
 */

import type {
  Flight,
  FlightsProvider,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "./types";

import {
  SkyScrapperClient,
  SkyScrapperHttpError,
  SkyScrapperTimeoutError,
} from "./skyScrapper.client";

/* -------------------------------------------------- */
/* ------------- TIMEOUT CONSTANTS ------------------- */
/* -------------------------------------------------- */

const LEG_TIMEOUT_MS = 35_000;
const SEARCH_ONE_WAY_TIMEOUT_MS = 30_000;
const POLLING_BUDGET_MS = 10_000;
const POLL_CALL_TIMEOUT_MS = 6_000;
const MAX_POLL_ATTEMPTS = 3;
const AUTOCOMPLETE_TIMEOUT_MS = 15_000;

const POLL_BACKOFF_MS = [1000, 2000, 4000] as const;

/* -------------------------------------------------- */
/* ----------------- JSON HELPERS ------------------- */
/* -------------------------------------------------- */

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

type JsonObject = { [k: string]: JsonValue };

function isObject(v: JsonValue): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getObject(v: JsonValue, key: string): JsonObject | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return isObject(child) ? child : null;
}

function getArray(v: JsonValue, key: string): JsonValue[] | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return Array.isArray(child) ? child : null;
}

function getString(v: JsonValue, key: string): string | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return typeof child === "string" ? child : null;
}

function getNumber(v: JsonValue, key: string): number | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return typeof child === "number" ? child : null;
}

/* -------------------------------------------------- */
/* ------------- UTILIDADES INTERNAS ---------------- */
/* -------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return sleep(ms);
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {
        // ignore
      }
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}



function extractItineraries(json: JsonValue): JsonValue[] {
  const data = getObject(json, "data");
  if (!data) return [];
  return getArray(data, "itineraries") ?? [];
}

function extractContext(json: JsonValue): {
  sessionId: string | null;
  status: string | null;
} {
  const data = getObject(json, "data");
  const context = data ? getObject(data, "context") : null;
  return {
    sessionId: context ? getString(context, "sessionId") : null,
    status: context ? getString(context, "status") : null,
  };
}

/* -------------------------------------------------- */
/* ------------- POLLING (BEST-EFFORT) -------------- */
/* -------------------------------------------------- */

async function tryImproveResults(
  client: SkyScrapperClient,
  initialJson: JsonValue,
  signal?: AbortSignal
): Promise<JsonValue> {
  const { sessionId, status } = extractContext(initialJson);

  if (status === "complete") {
    console.log("[SkyScrapper] Search already complete, skipping polling");
    return initialJson;
  }
  if (!sessionId) {
    console.log("[SkyScrapper] No sessionId, skipping polling");
    return initialJson;
  }

  const pollingStart = Date.now();
  let bestJson = initialJson;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (signal?.aborted) break;

    const elapsed = Date.now() - pollingStart;
    const remainingBudget = POLLING_BUDGET_MS - elapsed;
    if (remainingBudget <= 0) break;

    const backoff = POLL_BACKOFF_MS[attempt] ?? POLL_BACKOFF_MS[POLL_BACKOFF_MS.length - 1];
    const waitMs = Math.min(backoff, Math.max(0, remainingBudget - 500));
    if (waitMs > 0) await sleepWithSignal(waitMs, signal);

    if (signal?.aborted) break;

    const remainingAfterWait = POLLING_BUDGET_MS - (Date.now() - pollingStart);
    if (remainingAfterWait <= 0) break;
    const callTimeout = Math.min(POLL_CALL_TIMEOUT_MS, Math.max(1500, remainingAfterWait));

    try {
      const pollJson = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`,
        callTimeout,
        signal
      );

      const newCount = extractItineraries(pollJson).length;
      const oldCount = extractItineraries(bestJson).length;

      if (newCount >= oldCount) {
        bestJson = pollJson;
        console.log(
          `[SkyScrapper] Poll improved results: ${oldCount} → ${newCount} itineraries`
        );
      }

      const { status: newStatus } = extractContext(pollJson);
      if (newStatus === "complete") {
        console.log("[SkyScrapper] Search completed via polling");
        break;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[SkyScrapper] search-incomplete poll failed (attempt ${attempt}): ${msg}`
      );
      // Best-effort: continue polling within budget.
      continue;
    }
  }

  return bestJson;
}

/* -------------------------------------------------- */
/* ---- IN-MEMORY CACHE FOR RESOLVED PLACE IDS ------ */
/* -------------------------------------------------- */

/**
 * Cache of IATA code → entityId. Persists across requests within the
 * same server process, avoiding repeated auto-complete calls.
 * TTL: entries expire after 1 hour.
 */
const placeIdCache = new Map<string, { entityId: string; timestamp: number }>();
const PLACE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedPlaceId(iata: string): string | null {
  const entry = placeIdCache.get(iata.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PLACE_CACHE_TTL_MS) {
    placeIdCache.delete(iata.toUpperCase());
    return null;
  }
  return entry.entityId;
}

function setCachedPlaceId(iata: string, entityId: string): void {
  placeIdCache.set(iata.toUpperCase(), { entityId, timestamp: Date.now() });
}

/* -------------------------------------------------- */
/* -------------- PLACE RESOLUTION ------------------ */
/* -------------------------------------------------- */

/**
 * Resolve IATA code to SkyScrapper entityId.
 * Strategy: cache → /flights/auto-complete → /api/v1/flights/searchAirport → error
 */
async function resolvePlaceId(
  client: SkyScrapperClient,
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const upper = query.toUpperCase().trim();

  // 1. Check in-memory cache first
  const cached = getCachedPlaceId(upper);
  if (cached) {
    console.log(`[SkyScrapper] Place cache HIT for ${upper}: ${cached}`);
    return cached;
  }

  // 2. Try /flights/auto-complete (primary endpoint)
  try {
    const entityId = await resolveViaAutoComplete(client, upper, signal);
    setCachedPlaceId(upper, entityId);
    console.log(`[SkyScrapper] Resolved ${upper} via auto-complete: ${entityId}`);
    return entityId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] auto-complete failed for ${upper}: ${msg}`);
  }

  // 3. Fallback: try /api/v1/flights/searchAirport
  try {
    const entityId = await resolveViaSearchAirport(client, upper, signal);
    setCachedPlaceId(upper, entityId);
    console.log(`[SkyScrapper] Resolved ${upper} via searchAirport: ${entityId}`);
    return entityId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] searchAirport also failed for ${upper}: ${msg}`);
  }

  throw new Error(`Could not resolve place ID for ${upper}`);
}

async function resolveViaAutoComplete(
  client: SkyScrapperClient,
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const json = await client.get(
    `/flights/auto-complete?query=${encodeURIComponent(query)}`,
    AUTOCOMPLETE_TIMEOUT_MS,
    signal
  );

  const dataArr = getArray(json, "data");
  if (!dataArr || dataArr.length === 0) {
    throw new Error(`No place found for ${query}`);
  }

  const upper = query.toUpperCase();
  let airportExactMatch: string | null = null;
  let airportFuzzyMatch: string | null = null;
  let cityMatch: string | null = null;
  let firstFallback: string | null = null;

  for (const item of dataArr) {
    if (!isObject(item)) continue;

    const presentation = getObject(item, "presentation");
    if (!presentation) continue;

    const skyId = getString(presentation, "skyId");
    const id = getString(presentation, "id");
    if (!id) continue;
    if (!firstFallback) firstFallback = id;

    const navigation = getObject(item, "navigation");
    const entityType = navigation ? getString(navigation, "entityType") : null;
    const params = navigation
      ? getObject(navigation, "relevantFlightParams")
      : null;
    const flightSkyId = params ? getString(params, "skyId") : null;

    const effectiveSkyId = skyId?.toUpperCase() ?? "";
    const effectiveFlightSkyId = flightSkyId?.toUpperCase() ?? "";

    if (entityType === "AIRPORT") {
      if (effectiveSkyId === upper || effectiveFlightSkyId === upper) {
        airportExactMatch = id;
      } else if (!airportFuzzyMatch) {
        airportFuzzyMatch = id;
      }
    } else if (entityType === "CITY") {
      if (
        effectiveSkyId === upper ||
        effectiveSkyId.startsWith(upper) ||
        upper.startsWith(effectiveSkyId)
      ) {
        if (!cityMatch) cityMatch = id;
      }
    }
  }

  const result =
    airportExactMatch ?? airportFuzzyMatch ?? cityMatch ?? firstFallback;
  if (result) return result;
  throw new Error(`Invalid place data for ${query}`);
}

async function resolveViaSearchAirport(
  client: SkyScrapperClient,
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const json = await client.get(
    `/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}`,
    AUTOCOMPLETE_TIMEOUT_MS,
    signal
  );

  const dataArr = getArray(json, "data");
  if (!dataArr || dataArr.length === 0) {
    throw new Error(`No airport found for ${query} via searchAirport`);
  }

  const upper = query.toUpperCase();

  for (const item of dataArr) {
    if (!isObject(item)) continue;

    const skyId = getString(item, "skyId");
    const entityId = getString(item, "entityId");
    if (!entityId) continue;

    // Prefer exact IATA match
    if (skyId && skyId.toUpperCase() === upper) {
      return entityId;
    }
  }

  // Fallback: first valid entry
  for (const item of dataArr) {
    if (!isObject(item)) continue;
    const entityId = getString(item, "entityId");
    if (entityId) return entityId;
  }

  throw new Error(`Invalid airport data for ${query}`);
}

/* -------------------------------------------------- */
/* ---------- TYPED SEGMENT STRUCTURES -------------- */
/* -------------------------------------------------- */

/** Segment data extracted from SkyScrapper API, passed through to the mapper */
interface SkySegmentData {
  origin_iata: string;
  origin_name: string;
  destination_iata: string;
  destination_name: string;
  departure: string;
  arrival: string;
  duration_minutes: number;
  flight_number: string;
  airline_name: string;
  airline_code: string;
  airline_logo_url: string | null;
}

interface StopData {
  airport: string;
  airport_name: string;
  duration_minutes: number;
}

/* -------------------------------------------------- */
/* ----------- CARRIER LOGO RESOLUTION -------------- */
/* -------------------------------------------------- */

/**
 * Builds a name→logoUrl map from leg.carriers.marketing + leg.carriers.operating.
 * SkyScrapper puts logoUrl at the leg-level carrier, not inside each segment.
 */
function buildCarrierLogoMap(legJson: JsonObject): Map<string, string> {
  const map = new Map<string, string>();
  const carriers = getObject(legJson, "carriers");
  if (!carriers) return map;

  for (const arrayKey of ["marketing", "operating"]) {
    const arr = getArray(carriers, arrayKey);
    if (!arr) continue;
    for (const c of arr) {
      if (!isObject(c)) continue;
      const name = getString(c, "name");
      const logoUrl = getString(c, "logoUrl");
      if (name && logoUrl) map.set(name, logoUrl);
      const altId = getString(c, "alternateId");
      if (altId && logoUrl) map.set(altId, logoUrl);
    }
  }

  return map;
}

/* -------------------------------------------------- */
/* ------------- SEGMENT MAPPER --------------------- */
/* -------------------------------------------------- */

function mapSegment(
  segJson: JsonValue,
  logoMap: Map<string, string>
): SkySegmentData | null {
  if (!isObject(segJson)) return null;

  const origin = getObject(segJson, "origin");
  const destination = getObject(segJson, "destination");

  const originIata = origin
    ? (getString(origin, "displayCode") ?? getString(origin, "flightPlaceId") ?? "")
    : "";
  const destIata = destination
    ? (getString(destination, "displayCode") ?? getString(destination, "flightPlaceId") ?? "")
    : "";

  const departure = getString(segJson, "departure") ?? "";
  const arrival = getString(segJson, "arrival") ?? "";
  const durationMin = getNumber(segJson, "durationInMinutes") ?? 0;
  const flightNumber = getString(segJson, "flightNumber") ?? "";

  const marketingCarrier = getObject(segJson, "marketingCarrier");
  const operatingCarrier = getObject(segJson, "operatingCarrier");
  const carrier = marketingCarrier ?? operatingCarrier;

  const airlineName = carrier ? (getString(carrier, "name") ?? "Aerolínea") : "Aerolínea";
  const airlineCode = carrier ? (getString(carrier, "alternateId") ?? "") : "";

  const logoUrl =
    logoMap.get(airlineName) ?? logoMap.get(airlineCode) ?? null;

  return {
    origin_iata: originIata,
    origin_name: origin ? (getString(origin, "name") ?? "") : "",
    destination_iata: destIata,
    destination_name: destination ? (getString(destination, "name") ?? "") : "",
    departure,
    arrival,
    duration_minutes: durationMin,
    flight_number:
      airlineCode && flightNumber ? `${airlineCode}${flightNumber}` : flightNumber,
    airline_name: airlineName,
    airline_code: airlineCode,
    airline_logo_url: logoUrl,
  };
}

/* -------------------------------------------------- */
/* ------------- ITINERARY MAPPER ------------------- */
/* -------------------------------------------------- */

function mapItineraryToFlight(
  it: JsonValue,
  legIndex: number
): Flight | null {
  if (!isObject(it)) return null;

  const id =
    getString(it, "id") ??
    `sky_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const priceObj = getObject(it, "price");
  const price = priceObj ? (getNumber(priceObj, "raw") ?? 0) : 0;

  const legs = getArray(it, "legs");
  if (!legs || legs.length === 0) return null;

  const leg = legs[0];
  if (!isObject(leg)) return null;

  const duration = getNumber(leg, "durationInMinutes") ?? 0;
  const stopCount = getNumber(leg, "stopCount") ?? 0;
  const departure = getString(leg, "departure") ?? "";
  const arrival = getString(leg, "arrival") ?? "";

  const legOrigin = getObject(leg, "origin");
  const legDest = getObject(leg, "destination");
  const originIata = legOrigin
    ? (getString(legOrigin, "displayCode") ?? getString(legOrigin, "id") ?? "")
    : "";
  const destIata = legDest
    ? (getString(legDest, "displayCode") ?? getString(legDest, "id") ?? "")
    : "";
  const originName = legOrigin ? (getString(legOrigin, "name") ?? "") : "";
  const destName = legDest ? (getString(legDest, "name") ?? "") : "";

  const logoMap = buildCarrierLogoMap(leg);

  const carriers = getObject(leg, "carriers");
  const marketingArr = carriers ? getArray(carriers, "marketing") : null;

  let airlineName = "Aerolínea";
  let airlineCode = "";
  let airlineLogoUrl: string | null = null;

  if (marketingArr && marketingArr.length > 0) {
    const first = marketingArr[0];
    if (isObject(first)) {
      airlineName = getString(first, "name") ?? "Aerolínea";
      airlineCode = getString(first, "alternateId") ?? "";
      airlineLogoUrl = getString(first, "logoUrl") ?? null;
    }
  }

  const rawSegments = getArray(leg, "segments");
  const mappedSegments: SkySegmentData[] = [];

  if (rawSegments) {
    for (const seg of rawSegments) {
      const mapped = mapSegment(seg, logoMap);
      if (mapped) mappedSegments.push(mapped);
    }
  }

  const stops: StopData[] = [];

  for (let i = 0; i < mappedSegments.length - 1; i++) {
    const current = mappedSegments[i];
    const next = mappedSegments[i + 1];

    const arrTime = new Date(current.arrival).getTime();
    const depTime = new Date(next.departure).getTime();

    let layoverMinutes = 0;
    if (
      Number.isFinite(arrTime) &&
      Number.isFinite(depTime) &&
      depTime > arrTime
    ) {
      layoverMinutes = Math.round((depTime - arrTime) / 60000);
    }

    stops.push({
      airport: current.destination_iata,
      airport_name: current.destination_name,
      duration_minutes: layoverMinutes,
    });
  }

  let flightNumber = "";
  if (mappedSegments.length > 0) {
    flightNumber = mappedSegments[0].flight_number;
  }
  if (!flightNumber && airlineCode) {
    flightNumber = `${airlineCode}${100 + Math.floor(Math.random() * 900)}`;
  }

  return {
    id,
    price,
    duration,
    provider: "sky-scrapper",
    offerSource: "external",
    legIndex,
    departure_datetime: departure,
    arrival_datetime: arrival,
    airline: {
      iata_code: airlineCode,
      name: airlineName,
      logo_url: airlineLogoUrl,
    },
    airline_code: airlineCode,
    origin_airport: { iata_code: originIata, name: originName },
    destination_airport: { iata_code: destIata, name: destName },
    origin_iata: originIata,
    destination_iata: destIata,
    flight_number: flightNumber || "—",
    stops,
    stops_count: stopCount,
    final_price: price,
    is_exclusive_offer: false,
    available_seats: 9,
    sky_segments: mappedSegments,
  };
}

/* -------------------------------------------------- */
/* -------- SINGLE LEG SEARCH (WITH TIMEOUT) -------- */
/* -------------------------------------------------- */

async function searchOneLeg(
  client: SkyScrapperClient,
  leg: { origin: string; destination: string; departure_date: string },
  legIndex: number,
  passengers: number,
  providerErrors: string[],
  externalSignal?: AbortSignal
): Promise<Flight[]> {
  const legController = new AbortController();
  const timer = setTimeout(() => legController.abort(), LEG_TIMEOUT_MS);

  const onAbort = () => legController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) legController.abort();
    else externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await searchOneLegInternal(client, leg, legIndex, passengers, legController.signal);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] Leg ${legIndex} failed/timeout: ${msg}`);

    // For circuit breaker: track hard provider failures (timeouts / HTTP errors)
    if (err instanceof SkyScrapperTimeoutError) providerErrors.push(`timeout:${legIndex}`);
    else if (err instanceof SkyScrapperHttpError) providerErrors.push(`http:${legIndex}`);
    else providerErrors.push(`error:${legIndex}`);

    return [];
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      try {
        externalSignal.removeEventListener("abort", onAbort);
      } catch {
        // ignore
      }
    }
  }
}

async function searchOneLegInternal(
  client: SkyScrapperClient,
  leg: { origin: string; destination: string; departure_date: string },
  legIndex: number,
  passengers: number,
  signal?: AbortSignal
): Promise<Flight[]> {
  const date = String(leg.departure_date ?? "").trim();
  if (!date) return [];
  if (signal?.aborted) return [];

  const [fromEntityId, toEntityId] = await Promise.all([
    resolvePlaceId(client, leg.origin, signal),
    resolvePlaceId(client, leg.destination, signal),
  ]);

  console.log(`[SkyScrapper] Leg ${legIndex}: resolved ${leg.origin}→${fromEntityId}, ${leg.destination}→${toEntityId}`);

  const qs = new URLSearchParams({
    fromEntityId,
    toEntityId,
    departDate: date,
    adults: String(passengers),
    market: "US",
    locale: "en-US",
    currency: "USD",
  });

  const initialJson = await client.get(
    `/flights/search-one-way?${qs.toString()}`,
    SEARCH_ONE_WAY_TIMEOUT_MS,
    signal
  );

  const initialItineraries = extractItineraries(initialJson);
  console.log(
    `[SkyScrapper] Leg ${legIndex}: search-one-way returned ${initialItineraries.length} itineraries`
  );

  // Even if the first response has 0 itineraries, polling may complete later.
  // (This avoids false "no results" when provider is slow.)
  let finalJson = initialJson;
  try {
    finalJson = await tryImproveResults(client, initialJson, signal);
  } catch {
    finalJson = initialJson;
  }

  const finalItineraries = extractItineraries(finalJson);
  const flights: Flight[] = [];

  for (const it of finalItineraries) {
    const mapped = mapItineraryToFlight(it, legIndex);
    if (mapped) flights.push(mapped);
  }

  console.log(
    `[SkyScrapper] Leg ${legIndex}: mapped ${flights.length} flights total`
  );

  return flights;
}

/* -------------------------------------------------- */
/* -------------------- PROVIDER -------------------- */
/* -------------------------------------------------- */

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",

  async search(req: ProviderSearchRequest, opts?: { signal?: AbortSignal }): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();

    const providerErrors: string[] = [];

    const legPromises = req.legs.map((leg, legIndex) =>
      searchOneLeg(client, leg, legIndex, req.passengers ?? 1, providerErrors, opts?.signal)
    );

    const legResults = await Promise.all(legPromises);

    // If everything failed due to provider errors, surface it so the circuit breaker can trip.
    const total = legResults.reduce((sum, flights) => sum + flights.length, 0);
    if (total === 0 && providerErrors.length >= Math.max(1, req.legs.length)) {
      throw new Error(`SkyScrapper failed all legs (${providerErrors.join(",")})`);
    }

    return legResults.map((flights, legIndex) => ({
      legIndex,
      flights,
    }));
  },
};