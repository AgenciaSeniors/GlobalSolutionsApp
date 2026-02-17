/**
 * skyScrapperProvider — Provider de vuelos vía RapidAPI SkyScrapper.
 *
 * v5 — Fully typed (zero `any`). Extracts complete segment data from API
 * with real per-segment times, carriers, logos, and calculated layovers.
 */

import type {
  Flight,
  FlightsProvider,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "./types";

import { SkyScrapperClient } from "./skyScrapper.client";

/* -------------------------------------------------- */
/* ------------- TIMEOUT CONSTANTS ------------------- */
/* -------------------------------------------------- */

const LEG_TIMEOUT_MS = 25_000;
const POLLING_BUDGET_MS = 6_000;
const POLL_CALL_TIMEOUT_MS = 5_000;
const MAX_POLL_ATTEMPTS = 1;

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

function createTimeoutRace<T>(
  ms: number,
  label: string
): { promise: Promise<T>; cleanup: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${ms}ms budget`)),
      ms
    );
  });
  const cleanup = () => clearTimeout(timer);
  return { promise, cleanup };
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
  initialJson: JsonValue
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
    const elapsed = Date.now() - pollingStart;
    if (elapsed >= POLLING_BUDGET_MS) break;

    const waitMs = Math.min(1500, POLLING_BUDGET_MS - elapsed);
    if (waitMs <= 0) break;
    await sleep(waitMs);

    try {
      const pollJson = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`,
        POLL_CALL_TIMEOUT_MS
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
      break;
    }
  }

  return bestJson;
}

/* -------------------------------------------------- */
/* -------------- PLACE RESOLUTION ------------------ */
/* -------------------------------------------------- */

async function resolvePlaceId(
  client: SkyScrapperClient,
  query: string
): Promise<string> {
  const json = await client.get(
    `/flights/auto-complete?query=${encodeURIComponent(query)}`
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
      // Also index by alternateId (e.g. "BF", "NK")
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

  // Carrier: prefer marketing, fallback to operating
  const marketingCarrier = getObject(segJson, "marketingCarrier");
  const operatingCarrier = getObject(segJson, "operatingCarrier");
  const carrier = marketingCarrier ?? operatingCarrier;

  const airlineName = carrier ? (getString(carrier, "name") ?? "Aerolínea") : "Aerolínea";
  const airlineCode = carrier ? (getString(carrier, "alternateId") ?? "") : "";

  // Resolve logoUrl: try by name first, then by code
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

  // Leg-level origin/destination
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

  // Build logo map from leg-level carriers
  const logoMap = buildCarrierLogoMap(leg);

  // First marketing carrier (for top-level display)
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

  // ── Extract FULL segments ──
  const rawSegments = getArray(leg, "segments");
  const mappedSegments: SkySegmentData[] = [];

  if (rawSegments) {
    for (const seg of rawSegments) {
      const mapped = mapSegment(seg, logoMap);
      if (mapped) mappedSegments.push(mapped);
    }
  }

  // ── Calculate REAL layovers between segments ──
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

  // Flight number from first segment
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
    // Pass typed segments for the mapper
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
  passengers: number
): Promise<Flight[]> {
  const { promise: timeout, cleanup } = createTimeoutRace<Flight[]>(
    LEG_TIMEOUT_MS,
    `Leg ${legIndex} (${leg.origin}→${leg.destination})`
  );

  try {
    const result = await Promise.race([
      searchOneLegInternal(client, leg, legIndex, passengers),
      timeout,
    ]);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[SkyScrapper] Leg ${legIndex} failed/timeout: ${msg}`);
    return [];
  } finally {
    cleanup();
  }
}

async function searchOneLegInternal(
  client: SkyScrapperClient,
  leg: { origin: string; destination: string; departure_date: string },
  legIndex: number,
  passengers: number
): Promise<Flight[]> {
  const date = String(leg.departure_date ?? "").trim();
  if (!date) return [];

  const [fromEntityId, toEntityId] = await Promise.all([
    resolvePlaceId(client, leg.origin),
    resolvePlaceId(client, leg.destination),
  ]);

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
    `/flights/search-one-way?${qs.toString()}`
  );

  const initialItineraries = extractItineraries(initialJson);
  console.log(
    `[SkyScrapper] Leg ${legIndex}: search-one-way returned ${initialItineraries.length} itineraries`
  );

  if (initialItineraries.length === 0) return [];

  let finalJson = initialJson;
  try {
    finalJson = await tryImproveResults(client, initialJson);
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

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();

    const legPromises = req.legs.map((leg, legIndex) =>
      searchOneLeg(client, leg, legIndex, req.passengers ?? 1)
    );

    const legResults = await Promise.all(legPromises);

    return legResults.map((flights, legIndex) => ({
      legIndex,
      flights,
    }));
  },
};