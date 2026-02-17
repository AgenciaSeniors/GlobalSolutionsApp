/**
 * skyScrapperProvider — Provider de vuelos vía RapidAPI SkyScrapper.
 *
 * v3 — FIX PRINCIPAL: los itinerarios de search-one-way se extraen ANTES
 * del polling. Si el polling falla/timeout, se devuelven los resultados
 * parciales en vez de descartar todo.
 *
 * Resumen de timeouts:
 *   - client.get() default: 10s (auto-complete, search-one-way)
 *   - client.get() polling:  5s (search-incomplete, agresivo)
 *   - Polling budget total:  6s (máx 1 intento de search-incomplete)
 *   - Leg total:            25s (auto-complete‖ + search-one-way + polling)
 *   - Legs ejecutan en paralelo
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

/** Timeout total por leg (todo incluido) */
const LEG_TIMEOUT_MS = 25_000;

/** Máximo tiempo gastado en la fase de polling */
const POLLING_BUDGET_MS = 6_000;

/** Timeout por llamada individual de search-incomplete */
const POLL_CALL_TIMEOUT_MS = 5_000;

/** Máximo intentos de polling */
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

/**
 * Extrae itinerarios de cualquier JSON de respuesta de SkyScrapper.
 * Funciona tanto para search-one-way como search-incomplete.
 */
function extractItineraries(json: JsonValue): JsonValue[] {
  const data = getObject(json, "data");
  if (!data) return [];
  const itineraries = getArray(data, "itineraries");
  return itineraries ?? [];
}

/**
 * Extrae el sessionId y status de la respuesta.
 */
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

/**
 * Intenta mejorar los resultados vía search-incomplete.
 * 
 * REGLA CLAVE: Si el polling falla, devuelve el JSON ORIGINAL
 * (initialJson), no un JSON vacío. Así nunca perdemos datos.
 */
async function tryImproveResults(
  client: SkyScrapperClient,
  initialJson: JsonValue
): Promise<JsonValue> {
  const { sessionId, status } = extractContext(initialJson);

  // Si ya está completo, no hay nada que mejorar
  if (status === "complete") {
    console.log("[SkyScrapper] Search already complete, skipping polling");
    return initialJson;
  }

  // Sin sessionId no podemos hacer polling
  if (!sessionId) {
    console.log("[SkyScrapper] No sessionId, skipping polling");
    return initialJson;
  }

  const pollingStart = Date.now();
  let bestJson = initialJson;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - pollingStart;
    if (elapsed >= POLLING_BUDGET_MS) {
      console.log(
        `[SkyScrapper] Polling budget exhausted (${elapsed}ms)`
      );
      break;
    }

    // Breve pausa antes de poll
    const waitMs = Math.min(1500, POLLING_BUDGET_MS - elapsed);
    if (waitMs <= 0) break;
    await sleep(waitMs);

    try {
      // Usar timeout agresivo de 5s para polling
      const pollJson = await client.get(
        `/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`,
        POLL_CALL_TIMEOUT_MS
      );

      // ¿Mejoró? Solo actualizar si tiene más o igual itinerarios
      const newItineraries = extractItineraries(pollJson);
      const oldItineraries = extractItineraries(bestJson);

      if (newItineraries.length >= oldItineraries.length) {
        bestJson = pollJson;
        console.log(
          `[SkyScrapper] Poll improved results: ${oldItineraries.length} → ${newItineraries.length} itineraries`
        );
      }

      // Si ya completó, salir
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
      // NO actualizamos bestJson — mantenemos los datos anteriores
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
 * Busca una sola pierna. Tiene timeout total de LEG_TIMEOUT_MS.
 * 
 * FLUJO:
 * 1. Resolver places en paralelo (auto-complete × 2)
 * 2. search-one-way → obtener datos iniciales
 * 3. Mapear itinerarios del paso 2 (YA TENEMOS RESULTADOS AQUÍ)
 * 4. OPCIONAL: intentar mejorar vía search-incomplete
 *    - Si mejora → usar datos mejorados
 *    - Si falla/timeout → devolver datos del paso 3
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

  // ── 1. Resolve places en paralelo ──
  const [fromEntityId, toEntityId] = await Promise.all([
    resolvePlaceId(client, leg.origin),
    resolvePlaceId(client, leg.destination),
  ]);

  // ── 2. search-one-way (búsqueda inicial) ──
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

  // ── 3. Extraer itinerarios AHORA (antes del polling) ──
  const initialItineraries = extractItineraries(initialJson);

  console.log(
    `[SkyScrapper] Leg ${legIndex}: search-one-way returned ${initialItineraries.length} itineraries`
  );

  // Si search-one-way no trajo nada, el polling no va a ayudar
  if (initialItineraries.length === 0) {
    const { status } = extractContext(initialJson);
    console.log(
      `[SkyScrapper] Leg ${legIndex}: 0 itineraries, status="${status ?? "unknown"}". Nothing to improve.`
    );
    return [];
  }

  // ── 4. OPCIONAL: intentar mejorar vía polling ──
  let finalJson = initialJson;
  try {
    finalJson = await tryImproveResults(client, initialJson);
  } catch (err: unknown) {
    // Si el polling explota, usamos los datos iniciales
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[SkyScrapper] Leg ${legIndex}: polling failed, using initial data: ${msg}`
    );
    finalJson = initialJson;
  }

  // ── 5. Mapear itinerarios finales ──
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

    // Ejecutar legs en PARALELO
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