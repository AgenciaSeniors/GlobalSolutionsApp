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
const POLLING_BUDGET_MS = 60_000;
const POLL_CALL_TIMEOUT_MS = 6_000;
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

function getObject(v: JsonValue, key?: string): JsonObject | null {
  if (!isObject(v)) return null;
  if (key === undefined) return v;
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

/** Extract token (if provided by the API) for continued polling. */
function extractToken(json: JsonValue): string | null {
  const data = getObject(json, "data");
  return data ? getString(data, "token") : null;
}

/** Deterministic “hash” of itineraries to detect stability across polls. */
function hashItineraries(json: JsonValue): string {
  const its = extractItineraries(json);
  const keys: string[] = [];

  for (const it of its) {
    const obj = getObject(it);
    if (!obj) continue;

    const id = getString(obj, "id") ?? "";
    const price = getObject(obj, "price");
    const raw = price ? String(getNumber(price, "raw") ?? "") : "";

    const legsArr = getArray(obj, "legs") ?? [];
    const legIds: string[] = [];
    for (const leg of legsArr) {
      const legObj = getObject(leg);
      const legId = legObj ? getString(legObj, "id") : null;
      if (legId) legIds.push(legId);
    }

    keys.push(`${id}|${raw}|${legIds.join(",")}`);
  }

  keys.sort();
  return keys.join("||");
}

function jitter(ms: number, pct = 0.25): number {
  const delta = ms * pct;
  const rand = (Math.random() * 2 - 1) * delta; // [-delta, +delta]
  return Math.max(0, Math.round(ms + rand));
}

/* -------------------------------------------------- */
/* ------------- POLLING (PRODUCTION) --------------- */
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

  // Tunables (keep conservative defaults)
  const STABLE_HASH_ROUNDS = 2; // stop if results set doesn't change N rounds
  const NO_GROWTH_ROUNDS = 3;   // stop if count doesn't grow N rounds
  const SAFETY_MARGIN_MS = 600; // avoid budget overrun

  const token = extractToken(initialJson);

  const pollingStart = Date.now();
  let bestJson: JsonValue = initialJson;

  let bestCount = extractItineraries(bestJson).length;
  let lastHash = hashItineraries(bestJson);

  let stableHashRounds = 0;
  let noGrowthRounds = 0;

  let attempt = 0;

  while (Date.now() - pollingStart < POLLING_BUDGET_MS) {
    if (signal?.aborted) break;

    const elapsed = Date.now() - pollingStart;
    const remaining = POLLING_BUDGET_MS - elapsed;
    if (remaining <= SAFETY_MARGIN_MS) break;

    const baseBackoff =
      POLL_BACKOFF_MS[Math.min(attempt, POLL_BACKOFF_MS.length - 1)] ??
      POLL_BACKOFF_MS[POLL_BACKOFF_MS.length - 1];

    const waitMs = Math.min(jitter(baseBackoff), remaining - SAFETY_MARGIN_MS);
    if (waitMs > 0) await sleepWithSignal(waitMs, signal);
    if (signal?.aborted) break;

    const remainingAfterWait = POLLING_BUDGET_MS - (Date.now() - pollingStart);
    if (remainingAfterWait <= SAFETY_MARGIN_MS) break;

    const callTimeout = Math.min(
      POLL_CALL_TIMEOUT_MS,
      Math.max(1500, remainingAfterWait - SAFETY_MARGIN_MS)
    );

    const url = token
      ? `/flights/search-incomplete?sessionId=${encodeURIComponent(
          sessionId
        )}&token=${encodeURIComponent(token)}`
      : `/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`;

    let pollJson: JsonValue;
    try {
      pollJson = await client.get(url, callTimeout, signal);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[SkyScrapper] Poll failed (attempt ${attempt + 1}): ${msg}`
      );
      attempt++;
      continue;
    }

    const { status: newStatus } = extractContext(pollJson);
    const newCount = extractItineraries(pollJson).length;

    if (newCount > bestCount) {
      bestJson = pollJson;
      console.log(
        `[SkyScrapper] Poll improved: ${bestCount} → ${newCount} itineraries (status=${newStatus})`
      );

      bestCount = newCount;
      noGrowthRounds = 0;
      stableHashRounds = 0;
      lastHash = hashItineraries(bestJson);

      if (newStatus === "complete") {
        console.log("[SkyScrapper] Search completed via polling");
        break;
      }

      attempt++;
      continue;
    }

    // No growth: update stability counters
    noGrowthRounds++;

    const h = hashItineraries(pollJson);
    if (h === lastHash) stableHashRounds++;
    else {
      stableHashRounds = 0;
      lastHash = h;
    }

    console.log(
      `[SkyScrapper] No growth (count=${newCount}, best=${bestCount}) ` +
        `noGrowthRounds=${noGrowthRounds}/${NO_GROWTH_ROUNDS} ` +
        `stableHashRounds=${stableHashRounds}/${STABLE_HASH_ROUNDS} ` +
        `status=${newStatus}`
    );

    // Even without growth, if provider marks complete, take it and stop.
    if (newStatus === "complete") {
      bestJson = pollJson;
      console.log("[SkyScrapper] Completed (no growth on last poll)");
      break;
    }

    if (stableHashRounds >= STABLE_HASH_ROUNDS) {
      console.log("[SkyScrapper] Results stabilized, stopping polling");
      break;
    }

    if (noGrowthRounds >= NO_GROWTH_ROUNDS) {
      console.log("[SkyScrapper] No growth for several rounds, stopping polling");
      break;
    }

    attempt++;
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

  /**
   * Enriquecimientos de tiempo (best-effort).
   * - *_local: timestamp tal cual viene de la API (sin offset)
   * - *_utc: ISO en UTC (Z)
   * - *_cuba: ISO en horario de Cuba (incluye offset)
   */
  departure_local?: string;
  arrival_local?: string;
  departure_utc?: string | null;
  arrival_utc?: string | null;
  departure_cuba?: string | null;
  arrival_cuba?: string | null;
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
/* ------------- TIMEZONE NORMALIZATION -------------- */
/* -------------------------------------------------- */

/**
 * IMPORTANT:
 * SkyScrapper returns ISO strings WITHOUT timezone offset (e.g. "2024-02-15T18:40:00").
 * Those timestamps are intended to be interpreted in the LOCAL TIME of the corresponding airport.
 *
 * Strategy:
 * 1) Resolve each airport's UTC offset via /flights/airports (field: time = "UTC±HH:MM").
 * 2) Convert "local airport time" -> UTC instant using that offset.
 * 3) Convert UTC instant -> Cuba local time using IANA zone "America/Havana" (handles DST if present).
 * 4) Store:
 *    - *_datetime_utc  (ISO with Z)
 *    - *_datetime      (Cuba ISO with explicit offset, e.g. 2024-02-15T13:40:00-05:00)
 *    - Keep raw segment local times in *_local fields.
 */

const CUBA_TZ = "America/Havana";

const airportOffsetCache = new Map<string, { offsetMinutes: number; timestamp: number }>();
const airportOffsetInflight = new Map<string, Promise<number | null>>();
const AIRPORT_OFFSET_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function parseUtcOffsetMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;

  // Normalize minus signs: "−" (U+2212), "–" (en dash) -> "-"
  const s = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-");

  // Accept: "UTC-05:00", "UTC+10:00", "GMT-5", "UTC−05:00"
  const m = s.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return null;

  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3] ?? "0");

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return sign * (hh * 60 + mm);
}

function parseIsoLocalToUtcMillis(isoLocal: string, localOffsetMinutes: number): number | null {
  // isoLocal expected: YYYY-MM-DDTHH:mm:ss (no timezone)
  const m = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const ss = Number(m[6] ?? "0");

  if ([y, mo, d, hh, mi, ss].some((n) => !Number.isFinite(n))) return null;

  // Interpret the given timestamp as local time at the airport (UTC + offset)
  const localAsUtcMillis = Date.UTC(y, mo - 1, d, hh, mi, ss);
  const utcMillis = localAsUtcMillis - localOffsetMinutes * 60_000;
  return utcMillis;
}

function formatIsoWithOffset(parts: { y: string; mo: string; d: string; hh: string; mi: string; ss: string }, offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${parts.y}-${parts.mo}-${parts.d}T${parts.hh}:${parts.mi}:${parts.ss}${sign}${oh}:${om}`;
}

function getZonedParts(utcMillis: number, timeZone: string): { y: string; mo: string; d: string; hh: string; mi: string; ss: string } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(new Date(utcMillis));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    y: get("year"),
    mo: get("month"),
    d: get("day"),
    hh: get("hour"),
    mi: get("minute"),
    ss: get("second"),
  };
}

function getZonedOffsetMinutes(utcMillis: number, timeZone: string): number {
  // Compute offset by comparing "zoned wall-clock interpreted as UTC" vs actual UTC instant.
  const p = getZonedParts(utcMillis, timeZone);
  const wallAsUtc = Date.UTC(
    Number(p.y),
    Number(p.mo) - 1,
    Number(p.d),
    Number(p.hh),
    Number(p.mi),
    Number(p.ss)
  );
  return Math.round((wallAsUtc - utcMillis) / 60_000);
}

function toCubaIsoWithOffsetFromUtcMillis(utcMillis: number): string {
  const parts = getZonedParts(utcMillis, CUBA_TZ);
  const offsetMinutes = getZonedOffsetMinutes(utcMillis, CUBA_TZ);
  return formatIsoWithOffset(parts, offsetMinutes);
}

function toCubaIsoWithOffset(isoLocal: string, localOffsetMinutes: number | null): { cuba: string | null; utc: string | null; utcMillis: number | null } {
  if (localOffsetMinutes == null) return { cuba: null, utc: null, utcMillis: null };
  const utcMillis = parseIsoLocalToUtcMillis(isoLocal, localOffsetMinutes);
  if (utcMillis == null) return { cuba: null, utc: null, utcMillis: null };
  return {
    cuba: toCubaIsoWithOffsetFromUtcMillis(utcMillis),
    utc: new Date(utcMillis).toISOString(),
    utcMillis,
  };
}

function getCachedAirportOffset(iata: string): number | null {
  const key = iata.toUpperCase();
  const entry = airportOffsetCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AIRPORT_OFFSET_TTL_MS) {
    airportOffsetCache.delete(key);
    return null;
  }
  return entry.offsetMinutes;
}

function setCachedAirportOffset(iata: string, offsetMinutes: number): void {
  airportOffsetCache.set(iata.toUpperCase(), { offsetMinutes, timestamp: Date.now() });
}

async function resolveAirportOffsetMinutes(
  client: SkyScrapperClient,
  iata: string,
  signal?: AbortSignal
): Promise<number | null> {
  const key = iata.toUpperCase();
  const cached = getCachedAirportOffset(key);
  if (cached != null) return cached;

  const inflight = airportOffsetInflight.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<number | null> => {
    try {
      // Try a narrow query first (if supported); fall back to full list.
      const candidates: Array<{ query?: string }> = [{ query: key }, { query: key.slice(0, 3) }, {}];

      for (const params of candidates) {
        if (signal?.aborted) return null;

        // Algunos despliegues aceptan `?query=`, otros lo ignoran y devuelven el listado completo.
        const qs = params.query ? `?query=${encodeURIComponent(params.query)}` : '';
        const json = await client.get(`/flights/airports${qs}`, 10_000, signal);

        const dataArr =
          (isObject(json) && getArray(json, "data")) ||
          (Array.isArray(json) ? (json as unknown as JsonValue[]) : null);

        if (!dataArr) continue;

        // Find exact match by IATA
        for (const item of dataArr) {
          if (!isObject(item)) continue;
          const itemIata = (getString(item, "iata") ?? getString(item, "skyId") ?? "").toUpperCase();
          if (itemIata !== key) continue;

          const offset = parseUtcOffsetMinutes(getString(item, "time"));
          if (offset != null) {
            setCachedAirportOffset(key, offset);
            return offset;
          }
        }

        // If response was already "full list" and we didn't find it, no need to retry.
        if (!params.query) break;
      }

      return null;
    } catch {
      return null;
    } finally {
      airportOffsetInflight.delete(key);
    }
  })();

  airportOffsetInflight.set(key, promise);
  return promise;
}


/* -------------------------------------------------- */
/* ------------- ITINERARY MAPPER ------------------- */
/* -------------------------------------------------- */

async function mapItineraryToFlight(
  itinerary: JsonValue,
  legIndex: number,
  logoMap: Map<string, string>,
  client: SkyScrapperClient,
  signal?: AbortSignal
): Promise<Flight | null> {
  if (!isObject(itinerary)) return null;

  const id = getString(itinerary, "id") ?? `${legIndex}-${Date.now()}`;

  const priceObj = getObject(itinerary, "price");
  const price = priceObj ? (getNumber(priceObj, "raw") ?? 0) : 0;

  const legs = getArray(itinerary, "legs") ?? [];
  if (legs.length === 0) return null;

  // Pick the correct leg for this search
  const legJson = legs[0];
  if (!isObject(legJson)) return null;

  const originObj = getObject(legJson, "origin");
  const destObj = getObject(legJson, "destination");

  const originIata = originObj ? (getString(originObj, "id") ?? "") : "";
  const destIata = destObj ? (getString(destObj, "id") ?? "") : "";

  const originName = originObj ? (getString(originObj, "name") ?? "") : "";
  const destName = destObj ? (getString(destObj, "name") ?? "") : "";

  const duration = getNumber(legJson, "durationInMinutes") ?? 0;
  const stopCount = getNumber(legJson, "stopCount") ?? 0;

  const departureLocal = getString(legJson, "departure") ?? "";
  const arrivalLocal = getString(legJson, "arrival") ?? "";

  // Resolve airport UTC offsets (best-effort). Needed to interpret "local" timestamps.
  const neededIatas = new Set<string>();
  if (originIata) neededIatas.add(originIata.toUpperCase());
  if (destIata) neededIatas.add(destIata.toUpperCase());

  const segs = getArray(legJson, "segments") ?? [];
  for (const s of segs) {
    if (!isObject(s)) continue;
    const so = getObject(s, "origin");
    const sd = getObject(s, "destination");
    const soIata = so
      ? (getString(so, "displayCode") ?? getString(so, "flightPlaceId") ?? "")
      : "";
    const sdIata = sd
      ? (getString(sd, "displayCode") ?? getString(sd, "flightPlaceId") ?? "")
      : "";
    if (soIata) neededIatas.add(soIata.toUpperCase());
    if (sdIata) neededIatas.add(sdIata.toUpperCase());
  }

  const offsetMap = new Map<string, number | null>();
  await Promise.all(
    Array.from(neededIatas).map(async (iata) => {
      const off = await resolveAirportOffsetMinutes(client, iata, signal);
      offsetMap.set(iata.toUpperCase(), off);
    })
  );

  const depOff = offsetMap.get(originIata.toUpperCase()) ?? null;
  const arrOff = offsetMap.get(destIata.toUpperCase()) ?? null;

  const depNorm = toCubaIsoWithOffset(departureLocal, depOff);
  const arrNorm = toCubaIsoWithOffset(arrivalLocal, arrOff);

  // Carriers
  const carriersObj = getObject(legJson, "carriers");
  const marketingArr = carriersObj ? (getArray(carriersObj, "marketing") ?? []) : [];

  const carrier0 = marketingArr.length > 0 && isObject(marketingArr[0]) ? marketingArr[0] : null;

  const airlineName = carrier0 ? (getString(carrier0, "name") ?? "Aerolínea") : "Aerolínea";
  const rawLogoUrl = carrier0 ? (getString(carrier0, "logoUrl") ?? null) : null;

  // Upgrade favicon-sized logos to larger version
  const airlineLogoUrl =
    rawLogoUrl && rawLogoUrl.includes("/favicon/")
      ? rawLogoUrl.replace("/images/airlines/favicon/", "/images/airlines/")
      : rawLogoUrl ?? logoMap.get(airlineName) ?? null;

  const airlineCodeFromLogo = airlineLogoUrl ? airlineLogoUrl.split("/").pop()?.split(".")[0] : null;
  const airlineCode =
    airlineCodeFromLogo && airlineCodeFromLogo.length <= 3 ? airlineCodeFromLogo : "";

  // Segments mapping + time normalization
  const mappedSegments: SkySegmentData[] = [];
  for (const segJson of segs) {
    const seg = mapSegment(segJson, logoMap);
    if (!seg) continue;

    const segOriginOff = offsetMap.get(seg.origin_iata.toUpperCase()) ?? null;
    const segDestOff = offsetMap.get(seg.destination_iata.toUpperCase()) ?? null;

    const segDep = toCubaIsoWithOffset(seg.departure, segOriginOff);
    const segArr = toCubaIsoWithOffset(seg.arrival, segDestOff);

    mappedSegments.push({
      ...seg,
      // preserve original airport-local times
      departure_local: seg.departure,
      arrival_local: seg.arrival,
      // normalized instants
      departure_utc: segDep.utc,
      arrival_utc: segArr.utc,
      // Cuba wall-clock (for UI)
      departure_cuba: segDep.cuba,
      arrival_cuba: segArr.cuba,
      // For backwards compat keep original fields unchanged
      // (some UI logic may still expect airport-local)
    });
  }

  // Stops / layovers (computed on UTC instants, not naive Date parsing)
  const stops: StopData[] = [];
  for (let i = 0; i < mappedSegments.length - 1; i++) {
    const current = mappedSegments[i];
    const next = mappedSegments[i + 1];

    const arrUtc = typeof current.arrival_utc === "string" ? Date.parse(current.arrival_utc) : NaN;
    const depUtc = typeof next.departure_utc === "string" ? Date.parse(next.departure_utc) : NaN;

    let layoverMinutes = 0;
    if (Number.isFinite(arrUtc) && Number.isFinite(depUtc) && depUtc > arrUtc) {
      layoverMinutes = Math.round((depUtc - arrUtc) / 60000);
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

    // Cuba-normalized (primary fields)
    departure_datetime: depNorm.cuba ?? departureLocal,
    arrival_datetime: arrNorm.cuba ?? arrivalLocal,

    // Explicit instants for debugging / downstream normalization
    departure_datetime_utc: depNorm.utc,
    arrival_datetime_utc: arrNorm.utc,
    departure_datetime_local: departureLocal,
    arrival_datetime_local: arrivalLocal,

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

    // provider raw (segments enriched with cuba/utc fields)
    sky_segments: mappedSegments,

    // Small hint for consumers (helps diagnosing DST issues)
      _tz: {
        cuba: CUBA_TZ,
        airportOffsetsMinutes: offsetMap,
      },
    } as unknown as Flight;
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
  console.log(`[SkyScrapper] Leg ${legIndex}: searching ${leg.origin}→${leg.destination} | class=${qs.get('cabinClass')} | pax=${passengers}`);
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
    // Build a best-effort carrier logo map from the response so segment mapping can attach logo URLs.
    const logoMap = new Map<string, string>();
    for (const it of finalItineraries) {
      const legs = getArray(it, 'legs');
      if (!legs || legs.length === 0) continue;
      const leg0 = legs[0];
      if (!isObject(leg0)) continue;
      const perLegMap = buildCarrierLogoMap(leg0);
      for (const [k, v] of perLegMap.entries()) logoMap.set(k, v);
    }

    const flights: Flight[] = [];

  for (const it of finalItineraries) {
    const mapped = await mapItineraryToFlight(it, legIndex, logoMap, client, signal);
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
