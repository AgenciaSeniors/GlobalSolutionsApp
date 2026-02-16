type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function isJsonValue(v: unknown): v is JsonValue {
  if (v === null) return true;
  const t = typeof v;
  if (t === "boolean" || t === "number" || t === "string") return true;
  if (Array.isArray(v)) return v.every(isJsonValue);
  if (t === "object") {
    const rec = v as Record<string, unknown>;
    return Object.values(rec).every(isJsonValue);
  }
  return false;
}

export class SkyScrapperClient {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly host: string;

  constructor() {
    const key = process.env.RAPIDAPI_KEY;
    const host = process.env.RAPIDAPI_HOST || "sky-scrapper.p.rapidapi.com";
    if (!key) throw new Error("Missing RAPIDAPI_KEY env var");

    this.key = key;
    this.host = host;
    this.baseUrl = `https://${host}`;
  }

  private headers(): Record<string, string> {
    return {
      "x-rapidapi-key": this.key,
      "x-rapidapi-host": this.host,
    };
  }

  async get(pathAndQuery: string): Promise<JsonValue> {
    const url = `${this.baseUrl}${pathAndQuery}`;
    const res = await fetch(url, { method: "GET", headers: this.headers() });

    const text = await res.text();
    let parsed: unknown = null;

    if (text.trim().length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`SkyScrapper non-JSON response (status ${res.status})`);
      }
    }

    if (!isJsonValue(parsed)) {
      throw new Error(`SkyScrapper returned non-JSONValue (status ${res.status})`);
    }

    if (!res.ok) {
      // Intentar leer message de forma segura si existe
      const msg =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, JsonValue>)["message"] === "string"
          ? String((parsed as Record<string, JsonValue>)["message"])
          : `SkyScrapper error status ${res.status}`;

      throw new Error(msg);
    }

    return parsed;
  }
}
