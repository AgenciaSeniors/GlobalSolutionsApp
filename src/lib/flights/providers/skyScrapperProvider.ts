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
 * Polling controlado hasta que status === "complete"
 * Máximo 5 intentos
 */
async function completeSearch(
  client: SkyScrapperClient,
  initialJson: JsonValue
): Promise<JsonValue> {
  let json = initialJson;

  for (let attempt = 0; attempt < 5; attempt++) {
    const data = getObject(json, "data");
    const context = data ? getObject(data, "context") : null;
    const status = context ? getString(context, "status") : null;

    if (status === "complete") {
      return json;
    }

    const sessionId = context ? getString(context, "sessionId") : null;
    if (!sessionId) {
      return json;
    }

    await sleep(1200);

    try {
      json = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(
          sessionId
        )}`
      );
    } catch {
      return json;
    }
  }

  return json;
}

/**
 * Resuelve IATA → entityId
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

  for (const item of dataArr) {
    if (!isObject(item)) continue;

    const presentation = getObject(item, "presentation");
    if (!presentation) continue;

    const skyId = getString(presentation, "skyId");
    const id = getString(presentation, "id");

    if (skyId && id && skyId.toUpperCase() === upper) {
      return id;
    }
  }

  // fallback primer resultado
  const first = dataArr[0];
  if (isObject(first)) {
    const presentation = getObject(first, "presentation");
    const id = presentation ? getString(presentation, "id") : null;
    if (id) return id;
  }

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

  const id = getString(it, "id") ?? `sky_${Date.now()}`;

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

  const carriers = getObject(leg, "carriers");
  const marketing = carriers ? getArray(carriers, "marketing") : null;

  let airline: string | undefined;
  let airlineCode: string | undefined;

  if (marketing && marketing.length > 0) {
    const first = marketing[0];
    if (isObject(first)) {
      airline = getString(first, "name") ?? undefined;
      airlineCode = getString(first, "alternateId") ?? undefined;
    }
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
    airline,
    airline_code: airlineCode,
    stops_count: stopCount,
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
