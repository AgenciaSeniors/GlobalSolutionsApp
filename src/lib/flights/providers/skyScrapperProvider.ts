import type {
  Flight,
  FlightsProvider,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "./types";

import { SkyScrapperClient } from "./skyScrapper.client";

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
/* ----------------- UTILIDADES --------------------- */
/* -------------------------------------------------- */

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polling controlado hasta que status === "complete".
 * Máximo 3 intentos con backoff para no quemar créditos de RapidAPI.
 * Si ya tenemos itinerarios después del 1er poll, devuelve lo que hay.
 */
async function completeSearch(
  client: SkyScrapperClient,
  initialJson: JsonValue
): Promise<JsonValue> {
  let json = initialJson;

  for (let attempt = 0; attempt < 3; attempt++) {
    const data = getObject(json, "data");
    const context = data ? getObject(data, "context") : null;
    const status = context ? getString(context, "status") : null;

    if (status === "complete") {
      return json;
    }

    // If we already have itineraries after 1st poll, don't burn more credits
    const itineraries = data ? getArray(data, "itineraries") : null;
    if (itineraries && itineraries.length > 0 && attempt >= 1) {
      return json;
    }

    const sessionId = context ? getString(context, "sessionId") : null;
    if (!sessionId) {
      return json;
    }

    // Backoff: 1.5s, 2.5s, 3.5s
    await sleep(1500 + attempt * 1000);

    try {
      json = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(
          sessionId
        )}`
      );
    } catch {
      // If incomplete poll fails (429, timeout, etc), return what we have
      return json;
    }
  }

  return json;
}

/**
 * Resolve IATA code → base64 entity ID for the SkyScrapper search-one-way API.
 *
 * The auto-complete endpoint returns entries with:
 *   presentation.skyId   — e.g. "PTY" (airport) or "PTYA" (city)
 *   presentation.id      — base64 encoded entity (what search-one-way wants)
 *   navigation.entityType — "AIRPORT" | "CITY"
 *
 * Strategy: prefer AIRPORT exact skyId match > AIRPORT under matching city > CITY > first result
 */
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
    const id = getString(presentation, "id"); // base64 entity used by search-one-way

    if (!id) continue;

    // Track first valid as fallback
    if (!firstFallback) firstFallback = id;

    const navigation = getObject(item, "navigation");
    const entityType = navigation ? getString(navigation, "entityType") : null;

    // Check navigation.relevantFlightParams for more precise skyId
    const params = navigation ? getObject(navigation, "relevantFlightParams") : null;
    const flightSkyId = params ? getString(params, "skyId") : null;

    const effectiveSkyId = skyId?.toUpperCase() ?? "";
    const effectiveFlightSkyId = flightSkyId?.toUpperCase() ?? "";

    if (entityType === "AIRPORT") {
      // Exact airport match by skyId
      if (effectiveSkyId === upper || effectiveFlightSkyId === upper) {
        airportExactMatch = id;
      } else if (!airportFuzzyMatch) {
        // Airport under a related city
        airportFuzzyMatch = id;
      }
    } else if (entityType === "CITY") {
      // City-level match (e.g. PTYA for PTY, NYCA for JFK)
      if (
        effectiveSkyId === upper ||
        effectiveSkyId.startsWith(upper) ||
        upper.startsWith(effectiveSkyId)
      ) {
        if (!cityMatch) cityMatch = id;
      }
    }
  }

  // Priority: exact airport > fuzzy airport > city > first result
  const result = airportExactMatch ?? airportFuzzyMatch ?? cityMatch ?? firstFallback;
  if (result) return result;

  throw new Error(`Invalid place data for ${query}`);
}

/* -------------------------------------------------- */
/* ----------------- MAPPER ------------------------- */
/* -------------------------------------------------- */

function mapItineraryToFlight(
  it: JsonValue,
  legIndex: number
): Flight | null {
  if (!isObject(it)) return null;

  const id = getString(it, "id") ?? `sky_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const priceObj = getObject(it, "price");
  const price = priceObj ? getNumber(priceObj, "raw") : 0;

  const legs = getArray(it, "legs");
  if (!legs || legs.length === 0) return null;

  const leg = legs[0];
  if (!isObject(leg)) return null;

  const duration = getNumber(leg, "durationInMinutes") ?? 0;
  const stopCount = getNumber(leg, "stopCount") ?? 0;
  const departure = getString(leg, "departure") ?? "";
  const arrival = getString(leg, "arrival") ?? "";

  // Extract origin/destination from leg
  const legOrigin = getObject(leg, "origin");
  const legDest = getObject(leg, "destination");
  const originIata = legOrigin
    ? (getString(legOrigin, "displayCode") ?? getString(legOrigin, "id"))
    : null;
  const destIata = legDest
    ? (getString(legDest, "displayCode") ?? getString(legDest, "id"))
    : null;
  const originName = legOrigin ? getString(legOrigin, "name") : null;
  const destName = legDest ? getString(legDest, "name") : null;

  // Carriers
  const carriers = getObject(leg, "carriers");
  const marketing = carriers ? getArray(carriers, "marketing") : null;

  let airlineName: string | undefined;
  let airlineCode: string | undefined;
  let airlineLogoUrl: string | undefined;

  if (marketing && marketing.length > 0) {
    const first = marketing[0];
    if (isObject(first)) {
      airlineName = getString(first, "name") ?? undefined;
      airlineCode = getString(first, "alternateId") ?? undefined;
      airlineLogoUrl = getString(first, "logoUrl") ?? undefined;
    }
  }

  // Extract stop details from segments
  const segments = getArray(leg, "segments");
  const stops: Array<{ airport: string; duration_minutes: number }> = [];

  if (segments && segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!isObject(seg)) continue;
      const segDest = getObject(seg, "destination");
      const stopCode = segDest
        ? (getString(segDest, "displayCode") ?? getString(segDest, "id"))
        : null;
      stops.push({
        airport: stopCode ?? `ST${i + 1}`,
        duration_minutes: 60, // approximate layover
      });
    }
  }

  // Build flight number from first segment
  let flightNumber = "";
  if (segments && segments.length > 0) {
    const firstSeg = segments[0];
    if (isObject(firstSeg)) {
      const segCarrier = getObject(firstSeg, "marketingCarrier");
      const fnRaw = segCarrier ? getString(segCarrier, "flightNumber") : null;
      const codeRaw = segCarrier ? getString(segCarrier, "alternateId") : null;
      if (codeRaw && fnRaw) {
        flightNumber = `${codeRaw}${fnRaw}`;
      } else if (airlineCode) {
        const opCarrier = getObject(firstSeg, "operatingCarrier");
        const opFn = opCarrier ? getString(opCarrier, "flightNumber") : null;
        flightNumber = opFn ? `${airlineCode}${opFn}` : "";
      }
    }
  }

  if (!flightNumber && airlineCode) {
    flightNumber = `${airlineCode}${100 + Math.floor(Math.random() * 900)}`;
  }

  return {
    id,
    price: price ?? 0,
    duration,
    provider: "sky-scrapper",
    offerSource: "external",
    legIndex,
    departure_datetime: departure,
    arrival_datetime: arrival,
    airline: {
      iata_code: airlineCode ?? "",
      name: airlineName ?? "Aerolínea",
      logo_url: airlineLogoUrl ?? null,
    },
    airline_code: airlineCode,
    origin_airport: {
      iata_code: originIata ?? "",
      name: originName ?? "",
    },
    destination_airport: {
      iata_code: destIata ?? "",
      name: destName ?? "",
    },
    origin_iata: originIata ?? "",
    destination_iata: destIata ?? "",
    flight_number: flightNumber || "—",
    stops,
    stops_count: stopCount,
    final_price: price ?? 0,
    is_exclusive_offer: false,
    available_seats: 9,
  };
}

/* -------------------------------------------------- */
/* ----------------- PROVIDER ----------------------- */
/* -------------------------------------------------- */

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",

  async search(
    req: ProviderSearchRequest
  ): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();
    const result: ProviderSearchResponse = [];

    for (let legIndex = 0; legIndex < req.legs.length; legIndex++) {
      const leg = req.legs[legIndex];

      const date = String(leg.departure_date ?? "").trim();
      if (!date) {
        result.push({ legIndex, flights: [] });
        continue;
      }

      const fromEntityId = await resolvePlaceId(client, leg.origin);
      const toEntityId = await resolvePlaceId(client, leg.destination);

      const qs = new URLSearchParams({
        fromEntityId,
        toEntityId,
        departDate: date,
        adults: String(req.passengers ?? 1),
        market: "US",
        locale: "en-US",
        currency: "USD",
      });

      const initialJson = await client.get(
        `/flights/search-one-way?${qs.toString()}`
      );

      const finalJson = await completeSearch(client, initialJson);

      const data = getObject(finalJson, "data");
      const itineraries = data
        ? getArray(data, "itineraries")
        : null;

      const flights: Flight[] = [];

      if (itineraries) {
        for (const it of itineraries) {
          const mapped = mapItineraryToFlight(it, legIndex);
          if (mapped) flights.push(mapped);
        }
      }

      result.push({ legIndex, flights });
    }

    return result;
  },
};
