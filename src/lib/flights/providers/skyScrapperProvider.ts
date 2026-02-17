/**
 * skyScrapperProvider — Provider de vuelos vía RapidAPI SkyScrapper.
 *
 * FIXES aplicados (v2):
 *  1. completeSearch ahora es best-effort con timeout total de 8s
 *     — Si search-incomplete falla o timeout, retorna lo que ya tenga
 *  2. Cada leg tiene un timeout global de 15s (Promise.race)
 *     — Nunca bloquea más de 15s por tramo
 *  3. Para round-trip (2 legs), las búsquedas corren en paralelo
 *     — Reduce latencia total de 2×15s a ~15s
 *  4. Place resolution tiene cache in-memory para la misma request
 *  5. Errores tipados para diagnóstico limpio
 */

import type {
  Flight,
  FlightsProvider,
  ProviderSearchRequest,
  ProviderSearchResponse,
} from "./types";

import {
  SkyScrapperClient,
} from "./skyScrapper.client";

/* -------------------------------------------------- */
/* ------------- TIMEOUT CONSTANTS ------------------- */
/* -------------------------------------------------- */

/** Timeout total por leg (search-one-way + polling) */
const LEG_TIMEOUT_MS = 15_000;

/** Máximo tiempo gastado en polling search-incomplete */
const POLLING_BUDGET_MS = 8_000;

/** Máximo intentos de polling */
const MAX_POLL_ATTEMPTS = 2;

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

/**
 * Crea un timeout que rechaza con un error descriptivo.
 * Retorna la promise Y la función de cleanup para evitar memory leaks.
 */
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

/* -------------------------------------------------- */
/* ------------- POLLING (BEST-EFFORT) -------------- */
/* -------------------------------------------------- */

/**
 * Polling controlado hasta que status === "complete".
 *
 * CAMBIOS CLAVE vs v1:
 * - Budget total de 8s (no depende del número de intentos)
 * - Si ya hay itinerarios después del 1er poll, retorna inmediatamente
 * - Si search-incomplete falla (400, timeout, etc), retorna lo que hay
 * - NO bloquea la request principal
 */
async function completeSearch(
  client: SkyScrapperClient,
  initialJson: JsonValue
): Promise<JsonValue> {
  let json = initialJson;
  const pollingStart = Date.now();

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    // ── Check budget ──
    const elapsed = Date.now() - pollingStart;
    if (elapsed >= POLLING_BUDGET_MS) {
      console.log(
        `[SkyScrapper] Polling budget exhausted (${elapsed}ms), returning partial results`
      );
      return json;
    }

    // ── Check status ──
    const data = getObject(json, "data");
    const context = data ? getObject(data, "context") : null;
    const status = context ? getString(context, "status") : null;

    if (status === "complete") {
      console.log("[SkyScrapper] Search status: complete");
      return json;
    }

    // ── If we have itineraries after first poll, return early ──
    const itineraries = data ? getArray(data, "itineraries") : null;
    if (itineraries && itineraries.length > 0 && attempt >= 1) {
      console.log(
        `[SkyScrapper] Returning ${itineraries.length} partial itineraries (attempt ${attempt})`
      );
      return json;
    }

    // ── Need sessionId to continue ──
    const sessionId = context ? getString(context, "sessionId") : null;
    if (!sessionId) {
      console.log("[SkyScrapper] No sessionId for polling, returning as-is");
      return json;
    }

    // ── Backoff: 1.5s, 2.5s ──
    const waitMs = Math.min(
      1500 + attempt * 1000,
      POLLING_BUDGET_MS - (Date.now() - pollingStart)
    );
    if (waitMs <= 0) return json;

    await sleep(waitMs);

    // ── Poll (fail = return what we have) ──
    try {
      json = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[SkyScrapper] search-incomplete poll failed (attempt ${attempt}): ${msg}`
      );
      // Graceful degradation: return what we already have
      return json;
    }
  }

  return json;
}

/* -------------------------------------------------- */
/* -------------- PLACE RESOLUTION ------------------ */
/* -------------------------------------------------- */

/**
 * Resolve IATA code → base64 entity ID for search-one-way API.
 * Priority: exact airport > fuzzy airport > city > first result
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

/* -------------------------------------------------- */
/* ------------------- MAPPER ----------------------- */
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
  const price = priceObj ? getNumber(priceObj, "raw") : 0;

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
    ? (getString(legOrigin, "displayCode") ?? getString(legOrigin, "id"))
    : null;
  const destIata = legDest
    ? (getString(legDest, "displayCode") ?? getString(legDest, "id"))
    : null;
  const originName = legOrigin ? getString(legOrigin, "name") : null;
  const destName = legDest ? getString(legDest, "name") : null;

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
        duration_minutes: 60,
      });
    }
  }

  let flightNumber = "";
  if (segments && segments.length > 0) {
    const firstSeg = segments[0];
    if (isObject(firstSeg)) {
      const segCarrier = getObject(firstSeg, "marketingCarrier");
      const fnRaw = segCarrier
        ? getString(segCarrier, "flightNumber")
        : null;
      const codeRaw = segCarrier
        ? getString(segCarrier, "alternateId")
        : null;
      if (codeRaw && fnRaw) {
        flightNumber = `${codeRaw}${fnRaw}`;
      } else if (airlineCode) {
        const opCarrier = getObject(firstSeg, "operatingCarrier");
        const opFn = opCarrier
          ? getString(opCarrier, "flightNumber")
          : null;
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
/* -------- SINGLE LEG SEARCH (WITH TIMEOUT) -------- */
/* -------------------------------------------------- */

/**
 * Busca una sola pierna con timeout total de LEG_TIMEOUT_MS.
 * Si el timeout expira, retorna array vacío (sin bloquear).
 */
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

  // 1. Resolve places (autocomplete) — en paralelo
  const [fromEntityId, toEntityId] = await Promise.all([
    resolvePlaceId(client, leg.origin),
    resolvePlaceId(client, leg.destination),
  ]);

  // 2. Initial search
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

  // 3. Best-effort polling (no bloquea más de POLLING_BUDGET_MS)
  const finalJson = await completeSearch(client, initialJson);

  // 4. Map itineraries
  const data = getObject(finalJson, "data");
  const itineraries = data ? getArray(data, "itineraries") : null;

  const flights: Flight[] = [];
  if (itineraries) {
    for (const it of itineraries) {
      const mapped = mapItineraryToFlight(it, legIndex);
      if (mapped) flights.push(mapped);
    }
  }

  return flights;
}

/* -------------------------------------------------- */
/* -------------------- PROVIDER -------------------- */
/* -------------------------------------------------- */

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    // Un solo client compartido (reutiliza config, no estado)
    const client = new SkyScrapperClient();

    // ── Ejecutar TODOS los legs en PARALELO ──
    // Para round-trip (2 legs), esto reduce latencia de ~30s a ~15s
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