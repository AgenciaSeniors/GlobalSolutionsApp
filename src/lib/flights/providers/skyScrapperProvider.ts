import type {
  Flight,
  FlightsProvider,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "./types";

import { SkyScrapperClient } from "./skyScrapper.client";

/* -------------------------- JSON TYPES -------------------------- */

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
  return typeof child === "number" && Number.isFinite(child)
    ? child
    : null;
}

/* -------------------------- HELPERS -------------------------- */

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hace 1 intento extra si status === incomplete
 */
async function maybeCompleteOnce(
  client: SkyScrapperClient,
  json: JsonValue
): Promise<JsonValue> {
  const data = getObject(json, "data");
  const context = data ? getObject(data, "context") : null;
  const status = context ? getString(context, "status") : null;

  if (status !== "incomplete") return json;

  const sessionId = context ? getString(context, "sessionId") : null;
  if (!sessionId) return json;

  await sleep(800);

  return await client.get(
    `/flights/search-incomplete?sessionId=${encodeURIComponent(
      sessionId
    )}`
  );
}

/**
 * Resuelve presentation.id (base64) usando auto-complete
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
      return id; // presentation.id (base64)
    }
  }

  // fallback al primero válido
  for (const item of dataArr) {
    if (!isObject(item)) continue;
    const presentation = getObject(item, "presentation");
    const id = presentation ? getString(presentation, "id") : null;
    if (id) return id;
  }

  throw new Error(`Invalid place data for ${query}`);
}

/* -------------------------- MAPPER -------------------------- */

function mapItineraryToFlight(
  it: JsonValue,
  legIndex: number
): Flight | null {
  if (!isObject(it)) return null;

  const id = getString(it, "id") ?? `sky_${legIndex}_${Date.now()}`;

  const priceObj = getObject(it, "price");
  const rawPrice = priceObj ? getNumber(priceObj, "raw") : null;

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

  let airlineName: string | null = null;
  let airlineCode: string | null = null;

  if (marketing && marketing.length > 0) {
    const first = marketing[0];
    if (isObject(first)) {
      airlineName = getString(first, "name");
      airlineCode = getString(first, "alternateId");
    }
  }

  return {
    id,
    price: rawPrice ?? 0,
    duration,
    provider: "sky-scrapper",
    offerSource: "external",
    legIndex,

    departure_datetime: departure,
    arrival_datetime: arrival,
    airline: airlineName ?? undefined,
    airline_code: airlineCode ?? undefined,
    stops_count: stopCount,
  } as Flight;
}

/* -------------------------- PROVIDER -------------------------- */

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",

  async search(
    req: ProviderSearchRequest
  ): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();
    const result: ProviderSearchResponse = [];

    const legs = req.legs ?? [];

    for (let legIndex = 0; legIndex < legs.length; legIndex++) {
      const leg = legs[legIndex];

      const date = String(leg.departure_date ?? "").trim();
      if (!date) {
        result.push({ legIndex, flights: [] });
        continue;
      }

      const fromEntityId = await resolvePlaceId(
        client,
        String(leg.origin)
      );

      const toEntityId = await resolvePlaceId(
        client,
        String(leg.destination)
      );

      const qs = new URLSearchParams({
        fromEntityId,
        toEntityId,
        departDate: date,
        adults: String(req.passengers ?? 1),
      });

      const initialJson = await client.get(
        `/flights/search-one-way?${qs.toString()}`
      );

      const finalJson = await maybeCompleteOnce(
        client,
        initialJson
      );

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
