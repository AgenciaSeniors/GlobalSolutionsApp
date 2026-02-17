import { SkyScrapperClient } from "./skyScrapper.client";

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: JsonValue): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function getArray(v: JsonValue, key: string): JsonValue[] | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return Array.isArray(child) ? child : null;
}
function getString(v: JsonValue, key: string): string | null {
  if (!isObject(v)) return null;
  const child = v[key];
  return typeof child === "string" && child.trim() ? child.trim() : null;
}

export async function resolvePlace(input: string): Promise<{ skyId: string; entityId: string }> {
  const q = input.trim();
  if (!q) throw new Error("resolvePlace: empty input");

  const client = new SkyScrapperClient();
  const json = await client.get(`/api/v1/flights/searchAirport?query=${encodeURIComponent(q)}`);

  // Esperado: { status: true, data: [ ... ] }
  const dataArr = getArray(json, "data");
  if (!dataArr || dataArr.length === 0) throw new Error(`No places found for query=${q}`);

  const upper = q.toUpperCase();
  const looksIata = /^[A-Z]{3}$/.test(upper);

  let best: { skyId: string; entityId: string } | null = null;

  for (const item of dataArr) {
    if (!isObject(item)) continue;

    const skyId = getString(item, "skyId");
    const entityId = getString(item, "entityId");
    if (!skyId || !entityId) continue;

    // Si el input parece IATA, preferimos match exacto por skyId
    if (looksIata && skyId.toUpperCase() === upper) {
      return { skyId, entityId };
    }

    // Fallback: primer válido
    if (!best) best = { skyId, entityId };
  }

  if (!best) throw new Error(`Invalid place data for query=${q}`);
  return best;
}
