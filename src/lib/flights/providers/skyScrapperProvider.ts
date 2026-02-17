/**
 * skyScrapperProvider — v5, zero `any`, full segment extraction.
 */
import type { Flight, FlightsProvider, ProviderSearchRequest, ProviderSearchResponse } from "./types";
import { SkyScrapperClient } from "./skyScrapper.client";

const LEG_TIMEOUT_MS = 25_000;
const POLLING_BUDGET_MS = 6_000;
const POLL_CALL_TIMEOUT_MS = 5_000;
const MAX_POLL_ATTEMPTS = 1;

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: JsonValue): v is JsonObject { return typeof v === "object" && v !== null && !Array.isArray(v); }
function getObject(v: JsonValue, key: string): JsonObject | null { if (!isObject(v)) return null; const c = v[key]; return isObject(c) ? c : null; }
function getArray(v: JsonValue, key: string): JsonValue[] | null { if (!isObject(v)) return null; const c = v[key]; return Array.isArray(c) ? c : null; }
function getString(v: JsonValue, key: string): string | null { if (!isObject(v)) return null; const c = v[key]; return typeof c === "string" ? c : null; }
function getNumber(v: JsonValue, key: string): number | null { if (!isObject(v)) return null; const c = v[key]; return typeof c === "number" ? c : null; }

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function createTimeoutRace<T>(ms: number, label: string): { promise: Promise<T>; cleanup: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<T>((_, rej) => { timer = setTimeout(() => rej(new Error(`${label} exceeded ${ms}ms budget`)), ms); });
  return { promise, cleanup: () => clearTimeout(timer) };
}

function extractItineraries(json: JsonValue): JsonValue[] { const d = getObject(json, "data"); return d ? (getArray(d, "itineraries") ?? []) : []; }
function extractContext(json: JsonValue): { sessionId: string | null; status: string | null } {
  const d = getObject(json, "data"); const c = d ? getObject(d, "context") : null;
  return { sessionId: c ? getString(c, "sessionId") : null, status: c ? getString(c, "status") : null };
}

async function tryImproveResults(client: SkyScrapperClient, initialJson: JsonValue): Promise<JsonValue> {
  const { sessionId, status } = extractContext(initialJson);
  if (status === "complete" || !sessionId) return initialJson;
  const pollingStart = Date.now();
  let bestJson = initialJson;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (Date.now() - pollingStart >= POLLING_BUDGET_MS) break;
    const waitMs = Math.min(1500, POLLING_BUDGET_MS - (Date.now() - pollingStart));
    if (waitMs <= 0) break;
    await sleep(waitMs);
    try {
      const pollJson = await client.get(`/flights/search-incomplete?sessionId=${encodeURIComponent(sessionId)}`, POLL_CALL_TIMEOUT_MS);
      if (extractItineraries(pollJson).length >= extractItineraries(bestJson).length) bestJson = pollJson;
      if (extractContext(pollJson).status === "complete") break;
    } catch (err: unknown) {
      console.warn(`[SkyScrapper] poll failed (attempt ${attempt}): ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }
  return bestJson;
}

async function resolvePlaceId(client: SkyScrapperClient, query: string): Promise<string> {
  const json = await client.get(`/flights/auto-complete?query=${encodeURIComponent(query)}`);
  const dataArr = getArray(json, "data");
  if (!dataArr || dataArr.length === 0) throw new Error(`No place found for ${query}`);
  const upper = query.toUpperCase();
  let airportExact: string | null = null, airportFuzzy: string | null = null, city: string | null = null, first: string | null = null;
  for (const item of dataArr) {
    if (!isObject(item)) continue;
    const pres = getObject(item, "presentation"); if (!pres) continue;
    const id = getString(pres, "id"); if (!id) continue;
    if (!first) first = id;
    const nav = getObject(item, "navigation");
    const entityType = nav ? getString(nav, "entityType") : null;
    const skyId = (getString(pres, "skyId") ?? "").toUpperCase();
    const params = nav ? getObject(nav, "relevantFlightParams") : null;
    const flightSkyId = (params ? getString(params, "skyId") : null)?.toUpperCase() ?? "";
    if (entityType === "AIRPORT") {
      if (skyId === upper || flightSkyId === upper) airportExact = id;
      else if (!airportFuzzy) airportFuzzy = id;
    } else if (entityType === "CITY" && (skyId === upper || skyId.startsWith(upper) || upper.startsWith(skyId))) {
      if (!city) city = id;
    }
  }
  const result = airportExact ?? airportFuzzy ?? city ?? first;
  if (result) return result;
  throw new Error(`Invalid place data for ${query}`);
}

interface SkySegmentData {
  origin_iata: string; origin_name: string; destination_iata: string; destination_name: string;
  departure: string; arrival: string; duration_minutes: number; flight_number: string;
  airline_name: string; airline_code: string; airline_logo_url: string | null;
}

interface StopData { airport: string; airport_name: string; duration_minutes: number; }

function buildCarrierLogoMap(legJson: JsonObject): Map<string, string> {
  const map = new Map<string, string>();
  const carriers = getObject(legJson, "carriers"); if (!carriers) return map;
  for (const k of ["marketing", "operating"]) {
    const arr = getArray(carriers, k); if (!arr) continue;
    for (const c of arr) {
      if (!isObject(c)) continue;
      const name = getString(c, "name"); const logoUrl = getString(c, "logoUrl"); const altId = getString(c, "alternateId");
      if (name && logoUrl) map.set(name, logoUrl);
      if (altId && logoUrl) map.set(altId, logoUrl);
    }
  }
  return map;
}

function mapSegment(segJson: JsonValue, logoMap: Map<string, string>): SkySegmentData | null {
  if (!isObject(segJson)) return null;
  const origin = getObject(segJson, "origin"); const dest = getObject(segJson, "destination");
  const originIata = origin ? (getString(origin, "displayCode") ?? getString(origin, "flightPlaceId") ?? "") : "";
  const destIata = dest ? (getString(dest, "displayCode") ?? getString(dest, "flightPlaceId") ?? "") : "";
  const carrier = getObject(segJson, "marketingCarrier") ?? getObject(segJson, "operatingCarrier");
  const airlineName = carrier ? (getString(carrier, "name") ?? "Aerolínea") : "Aerolínea";
  const airlineCode = carrier ? (getString(carrier, "alternateId") ?? "") : "";
  const flightNumber = getString(segJson, "flightNumber") ?? "";
  return {
    origin_iata: originIata, origin_name: origin ? (getString(origin, "name") ?? "") : "",
    destination_iata: destIata, destination_name: dest ? (getString(dest, "name") ?? "") : "",
    departure: getString(segJson, "departure") ?? "", arrival: getString(segJson, "arrival") ?? "",
    duration_minutes: getNumber(segJson, "durationInMinutes") ?? 0,
    flight_number: airlineCode && flightNumber ? `${airlineCode}${flightNumber}` : flightNumber,
    airline_name: airlineName, airline_code: airlineCode,
    airline_logo_url: logoMap.get(airlineName) ?? logoMap.get(airlineCode) ?? null,
  };
}

function mapItineraryToFlight(it: JsonValue, legIndex: number): Flight | null {
  if (!isObject(it)) return null;
  const id = getString(it, "id") ?? `sky_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const priceObj = getObject(it, "price"); const price = priceObj ? (getNumber(priceObj, "raw") ?? 0) : 0;
  const legs = getArray(it, "legs"); if (!legs || legs.length === 0) return null;
  const leg = legs[0]; if (!isObject(leg)) return null;
  const duration = getNumber(leg, "durationInMinutes") ?? 0;
  const stopCount = getNumber(leg, "stopCount") ?? 0;
  const departure = getString(leg, "departure") ?? "";
  const arrival = getString(leg, "arrival") ?? "";
  const legOrigin = getObject(leg, "origin"); const legDest = getObject(leg, "destination");
  const originIata = legOrigin ? (getString(legOrigin, "displayCode") ?? getString(legOrigin, "id") ?? "") : "";
  const destIata = legDest ? (getString(legDest, "displayCode") ?? getString(legDest, "id") ?? "") : "";
  const originName = legOrigin ? (getString(legOrigin, "name") ?? "") : "";
  const destName = legDest ? (getString(legDest, "name") ?? "") : "";

  const logoMap = buildCarrierLogoMap(leg);
  const carriers = getObject(leg, "carriers"); const marketingArr = carriers ? getArray(carriers, "marketing") : null;
  let airlineName = "Aerolínea", airlineCode = "", airlineLogoUrl: string | null = null;
  if (marketingArr && marketingArr.length > 0) {
    const first = marketingArr[0];
    if (isObject(first)) { airlineName = getString(first, "name") ?? "Aerolínea"; airlineCode = getString(first, "alternateId") ?? ""; airlineLogoUrl = getString(first, "logoUrl") ?? null; }
  }

  const rawSegments = getArray(leg, "segments"); const mappedSegments: SkySegmentData[] = [];
  if (rawSegments) { for (const seg of rawSegments) { const m = mapSegment(seg, logoMap); if (m) mappedSegments.push(m); } }

  const stops: StopData[] = [];
  for (let i = 0; i < mappedSegments.length - 1; i++) {
    const cur = mappedSegments[i]; const next = mappedSegments[i + 1];
    const arrTime = new Date(cur.arrival).getTime(); const depTime = new Date(next.departure).getTime();
    let layover = 0;
    if (Number.isFinite(arrTime) && Number.isFinite(depTime) && depTime > arrTime) layover = Math.round((depTime - arrTime) / 60000);
    stops.push({ airport: cur.destination_iata, airport_name: cur.destination_name, duration_minutes: layover });
  }

  let flightNumber = mappedSegments.length > 0 ? mappedSegments[0].flight_number : "";
  if (!flightNumber && airlineCode) flightNumber = `${airlineCode}${100 + Math.floor(Math.random() * 900)}`;

  return {
    id, price, duration, provider: "sky-scrapper", offerSource: "external", legIndex,
    departure_datetime: departure, arrival_datetime: arrival,
    airline: { iata_code: airlineCode, name: airlineName, logo_url: airlineLogoUrl },
    airline_code: airlineCode,
    origin_airport: { iata_code: originIata, name: originName },
    destination_airport: { iata_code: destIata, name: destName },
    origin_iata: originIata, destination_iata: destIata,
    flight_number: flightNumber || "—", stops, stops_count: stopCount,
    final_price: price, is_exclusive_offer: false, available_seats: 9,
    sky_segments: mappedSegments,
  };
}

async function searchOneLeg(client: SkyScrapperClient, leg: { origin: string; destination: string; departure_date: string }, legIndex: number, passengers: number): Promise<Flight[]> {
  const { promise: timeout, cleanup } = createTimeoutRace<Flight[]>(LEG_TIMEOUT_MS, `Leg ${legIndex} (${leg.origin}→${leg.destination})`);
  try { return await Promise.race([searchOneLegInternal(client, leg, legIndex, passengers), timeout]); }
  catch (err: unknown) { console.warn(`[SkyScrapper] Leg ${legIndex} failed/timeout: ${err instanceof Error ? err.message : String(err)}`); return []; }
  finally { cleanup(); }
}

async function searchOneLegInternal(client: SkyScrapperClient, leg: { origin: string; destination: string; departure_date: string }, legIndex: number, passengers: number): Promise<Flight[]> {
  const date = String(leg.departure_date ?? "").trim(); if (!date) return [];
  const [fromEntityId, toEntityId] = await Promise.all([resolvePlaceId(client, leg.origin), resolvePlaceId(client, leg.destination)]);
  const qs = new URLSearchParams({ fromEntityId, toEntityId, departDate: date, adults: String(passengers), market: "US", locale: "en-US", currency: "USD" });
  const initialJson = await client.get(`/flights/search-one-way?${qs.toString()}`);
  const initialItineraries = extractItineraries(initialJson);
  console.log(`[SkyScrapper] Leg ${legIndex}: search-one-way returned ${initialItineraries.length} itineraries`);
  if (initialItineraries.length === 0) return [];
  let finalJson = initialJson;
  try { finalJson = await tryImproveResults(client, initialJson); } catch { finalJson = initialJson; }
  const flights: Flight[] = [];
  for (const it of extractItineraries(finalJson)) { const m = mapItineraryToFlight(it, legIndex); if (m) flights.push(m); }
  console.log(`[SkyScrapper] Leg ${legIndex}: mapped ${flights.length} flights total`);
  return flights;
}

export const skyScrapperProvider: FlightsProvider = {
  id: "sky-scrapper",
  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const client = new SkyScrapperClient();
    const legResults = await Promise.all(req.legs.map((leg, i) => searchOneLeg(client, leg, i, req.passengers ?? 1)));
    return legResults.map((flights, i) => ({ legIndex: i, flights }));
  },
};