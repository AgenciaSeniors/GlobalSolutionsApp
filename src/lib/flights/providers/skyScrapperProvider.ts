/**
 * skyScrapperProvider — Provider de vuelos vía RapidAPI SkyScrapper.
 *
 * v7 — Fixes:
 *  1. Backoff adjusted to audit spec: [1500, 3000, 6000] ms
 *  2. Concurrent place resolution deduplication (avoids duplicate calls for same IATA)
 *  3. Improved polling budget enforcement
 *  4. Better logging with elapsed times
 *  5. Fully typed (zero any)
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

/** Backoff per audit spec C1.1: 1.5s, 3s, 6s */
const POLL_BACKOFF_MS = [1500, 3000, 6000] as const;

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

    const backoff =
      POLL_BACKOFF_MS[attempt] ?? POLL_BACKOFF_MS[POLL_BACKOFF_MS.length - 1];
    const waitMs = Math.min(backoff, Math.max(0, remainingBudget - 500));
    if (waitMs > 0) await sleepWithSignal(waitMs, signal);

    if (signal?.aborted) break;

    const remainingAfterWait = POLLING_BUDGET_MS - (Date.now() - pollingStart);
    if (remainingAfterWait <= 0) break;
    const callTimeout = Math.min(
      POLL_CALL_TIMEOUT_MS,
      Math.max(1500, remainingAfterWait)
    );

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
      continue;
    }
  }

  return bestJson;
}

/* -------------------------------------------------- */
/* ---- IN-MEMORY CACHE FOR RESOLVED PLACE IDS ------ */
/* -------------------------------------------------- */

const placeIdCache = new Map<
  string,
  { entityId: string; timestamp: number }
>();
const PLACE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-flight deduplication: if multiple legs resolve the same IATA concurrently,
 * share the same Promise instead of firing duplicate API calls.
 */
const placeIdInflight = new Map<string, Promise<string>>();

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
  placeIdCache.set(iata.toUpperCase(), {
    entityId,
    timestamp: Date.now(),
  });
}

/* -------------------------------------------------- */
/* -------------- PLACE RESOLUTION ------------------ */
/* -------------------------------------------------- */

async function resolvePlaceId(
  client: SkyScrapperClient,
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const upper = query.toUpperCase().trim();

  // 1. Check in-memory cache
  const cached = getCachedPlaceId(upper);
  if (cached) {
    console.log(`[SkyScrapper] Place cache HIT for ${upper}: ${cached}`);
    return cached;
  }

  // 2. Check in-flight deduplication
  const inflight = placeIdInflight.get(upper);
  if (inflight) {
    console.log(`[SkyScrapper] Place resolution dedupe HIT for ${upper}`);
    return inflight;
  }

  // 3. Fire resolution and register in-flight
  const promise = resolvePlaceIdInternal(client, upper, signal).finally(() => {
    placeIdInflight.delete(upper);
  });
  placeIdInflight.set(upper, promise);

  return promise;
}

/**
 * Fallback city names for IATA codes that the SkyScrapper auto-complete
 * fails to resolve when searched by code alone.
 * This map is checked ONLY when the primary auto-complete returns no results.
 */
const IATA_CITY_FALLBACK: Record<string, string> = {
  CUN: "Cancun",
  GDL: "Guadalajara",
  MTY: "Monterrey",
  SJO: "San Jose Costa Rica",
  PTY: "Panama City",
  BOG: "Bogota",
  MDE: "Medellin",
  LIM: "Lima",
  SCL: "Santiago Chile",
  EZE: "Buenos Aires",
  GRU: "Sao Paulo",
  GIG: "Rio de Janeiro",
  UIO: "Quito",
  CCS: "Caracas",
  SDQ: "Santo Domingo",
  SJU: "San Juan Puerto Rico",
  NAS: "Nassau",
  MBJ: "Montego Bay",
  PUJ: "Punta Cana",
  HAV: "Havana",
  TPA: "Tampa",
  FLL: "Fort Lauderdale",
  MCO: "Orlando",
  ATL: "Atlanta",
  DFW: "Dallas",
  IAH: "Houston",
  LAX: "Los Angeles",
  SFO: "San Francisco",
  JFK: "New York JFK",
  EWR: "Newark",
  ORD: "Chicago",
  YYZ: "Toronto",
  YUL: "Montreal",
  MEX: "Mexico City",
  TIJ: "Tijuana",
  MAD: "Madrid",
  BCN: "Barcelona",
  CDG: "Paris",
  LHR: "London Heathrow",
  FCO: "Rome",
  AMS: "Amsterdam",
  FRA: "Frankfurt",
  MUC: "Munich",
  LIS: "Lisbon",
};

async function resolvePlaceIdInternal(
  client: SkyScrapperClient,
  upper: string,
  signal?: AbortSignal
): Promise<string> {
  // Try /flights/auto-complete with IATA code (primary)
  try {
    const entityId = await resolveViaAutoComplete(client, upper, signal);
    setCachedPlaceId(upper, entityId);
    console.log(
      `[SkyScrapper] Resolved ${upper} via auto-complete: ${entityId}`
    );
    return entityId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] auto-complete failed for ${upper}: ${msg}`);
  }

  // Fallback 1: retry auto-complete with city name instead of IATA code
  const cityName = IATA_CITY_FALLBACK[upper];
  if (cityName) {
    try {
      const entityId = await resolveViaAutoComplete(client, cityName, signal);
      setCachedPlaceId(upper, entityId);
      console.log(
        `[SkyScrapper] Resolved ${upper} via city-name fallback "${cityName}": ${entityId}`
      );
      return entityId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[SkyScrapper] city-name fallback "${cityName}" also failed for ${upper}: ${msg}`
      );
    }
  }

  // Fallback 2: try /api/v1/flights/searchAirport (may not exist on all API versions)
  try {
    const entityId = await resolveViaSearchAirport(client, upper, signal);
    setCachedPlaceId(upper, entityId);
    console.log(
      `[SkyScrapper] Resolved ${upper} via searchAirport: ${entityId}`
    );
    return entityId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[SkyScrapper] searchAirport also failed for ${upper}: ${msg}`
    );
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
    const entityType = navigation
      ? getString(navigation, "entityType")
      : null;
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

    if (skyId && skyId.toUpperCase() === upper) {
      return entityId;
    }
  }

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
    ? (getString(origin, "displayCode") ??
      getString(origin, "flightPlaceId") ??
      "")
    : "";
  const destIata = destination
    ? (getString(destination, "displayCode") ??
      getString(destination, "flightPlaceId") ??
      "")
    : "";

  const departure = getString(segJson, "departure") ?? "";
  const arrival = getString(segJson, "arrival") ?? "";
  const durationMin = getNumber(segJson, "durationInMinutes") ?? 0;
  const flightNumber = getString(segJson, "flightNumber") ?? "";

  const marketingCarrier = getObject(segJson, "marketingCarrier");
  const operatingCarrier = getObject(segJson, "operatingCarrier");
  const carrier = marketingCarrier ?? operatingCarrier;

  const airlineName = carrier
    ? (getString(carrier, "name") ?? "Aerolínea")
    : "Aerolínea";
  const airlineCode = carrier
    ? (getString(carrier, "alternateId") ?? "")
    : "";

  const rawLogoUrl =
    logoMap.get(airlineName) ?? logoMap.get(airlineCode) ?? null;
  // Upgrade favicon-sized logos to larger version
  const logoUrl =
    rawLogoUrl && rawLogoUrl.includes("/favicon/")
      ? rawLogoUrl.replace("/images/airlines/favicon/", "/images/airlines/")
      : rawLogoUrl;

  return {
    origin_iata: originIata,
    origin_name: origin ? (getString(origin, "name") ?? "") : "",
    destination_iata: destIata,
    destination_name: destination
      ? (getString(destination, "name") ?? "")
      : "",
    departure,
    arrival,
    duration_minutes: durationMin,
    flight_number:
      airlineCode && flightNumber
        ? `${airlineCode}${flightNumber}`
        : flightNumber,
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
    ? (getString(legOrigin, "displayCode") ??
      getString(legOrigin, "id") ??
      "")
    : "";
  const destIata = legDest
    ? (getString(legDest, "displayCode") ??
      getString(legDest, "id") ??
      "")
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
      const rawLogo = getString(first, "logoUrl") ?? null;
      // SkyScrapper returns favicon-sized logos (/favicon/XX.png = 16px).
      // Upgrade to larger version by removing /favicon/ prefix, or use gstatic fallback.
      if (rawLogo && rawLogo.includes("/favicon/")) {
        airlineLogoUrl = rawLogo.replace("/images/airlines/favicon/", "/images/airlines/");
      } else {
        airlineLogoUrl = rawLogo;
      }
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
  cabinClass: string,
  providerErrors: string[],
  externalSignal?: AbortSignal
): Promise<Flight[]> {
  const legController = new AbortController();
  const timer = setTimeout(() => legController.abort(), LEG_TIMEOUT_MS);

  const onAbort = () => legController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) legController.abort();
    else
      externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await searchOneLegInternal(
      client,
      leg,
      legIndex,
      passengers,
      cabinClass,
      legController.signal
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] Leg ${legIndex} failed/timeout: ${msg}`);

    if (err instanceof SkyScrapperTimeoutError)
      providerErrors.push(`timeout:${legIndex}`);
    else if (err instanceof SkyScrapperHttpError)
      providerErrors.push(`http:${legIndex}`);
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
  cabinClass: string,
  signal?: AbortSignal
): Promise<Flight[]> {
  const t0 = Date.now();
  const date = String(leg.departure_date ?? "").trim();
  if (!date) return [];
  if (signal?.aborted) return [];

  const [fromEntityId, toEntityId] = await Promise.all([
    resolvePlaceId(client, leg.origin, signal),
    resolvePlaceId(client, leg.destination, signal),
  ]);

  console.log(
    `[SkyScrapper] Leg ${legIndex}: resolved ${leg.origin}→${fromEntityId}, ${leg.destination}→${toEntityId} (${Date.now() - t0}ms)`
  );

  const qs = new URLSearchParams({
    fromEntityId,
    toEntityId,
    departDate: date,
    adults: String(passengers),
    cabinClass: cabinClass || "economy",
    market: "US",
    locale: "en-US",
    currency: "USD",
  });
console.log(`[DEBUG] Llamando a SkyScrapper con clase: ${qs.get('cabinClass')} para la ruta ${leg.origin}-${leg.destination}`);
  const initialJson = await client.get(
    `/flights/search-one-way?${qs.toString()}`,
    SEARCH_ONE_WAY_TIMEOUT_MS,
    signal
  );

  const initialItineraries = extractItineraries(initialJson);
  console.log(
    `[SkyScrapper] Leg ${legIndex}: search-one-way returned ${initialItineraries.length} itineraries (${Date.now() - t0}ms)`
  );

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
    `[SkyScrapper] Leg ${legIndex}: mapped ${flights.length} flights total (${Date.now() - t0}ms)`
  );

  return flights;
}

/* -------------------------------------------------- */
/* -------------------- PROVIDER -------------------- */
/* -------------------------------------------------- */

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",

  async search(
    req: ProviderSearchRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();

    const providerErrors: string[] = [];

    const legPromises = req.legs.map((leg, legIndex) =>
      searchOneLeg(
        client,
        leg,
        legIndex,
        req.passengers ?? 1,
        req.cabinClass || "economy",
        providerErrors,
        opts?.signal
      )
    );

    const legResults = await Promise.all(legPromises);

    // If everything failed, surface it so the circuit breaker can trip.
    const total = legResults.reduce(
      (sum, flights) => sum + flights.length,
      0
    );
    if (
      total === 0 &&
      providerErrors.length >= Math.max(1, req.legs.length)
    ) {
      throw new Error(
        `SkyScrapper failed all legs (${providerErrors.join(",")})`
      );
    }

    return legResults.map((flights, legIndex) => ({
      legIndex,
      flights,
    }));
  },
};
