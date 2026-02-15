import type { FlightsProvider, ProviderSearchRequest, ProviderSearchResponse, Flight } from "./types";
import { XMLParser } from "fast-xml-parser";

const DUFFEL_BASE_URL = "https://api.duffel.com";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getEnv(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const s = v.trim();
  return s.length ? s : null;
}

function parseMaybeXmlOrJson(payload: unknown): any {
  if (typeof payload === "string") {
    const s = payload.trim();
    if (s.startsWith("<")) {
      const parser = new XMLParser({ ignoreAttributes: false });
      return parser.parse(s);
    }
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  }
  return payload;
}

function toFlightFromDuffelOffer(offer: any): Flight {
  // Duffel: total_amount, total_currency, slices, segments, etc.
  const id = String(offer?.id ?? "");
  const price = Number(offer?.total_amount ?? offer?.totalAmount ?? 0);

  // duración: si no la encuentras fácil, no inventes: 0 y luego se mejora
  const duration = Number(offer?.slices?.[0]?.duration ?? 0);

  return {
    id: id || `duffel-${Math.random().toString(16).slice(2)}`,
    price: Number.isFinite(price) ? price : 0,
    duration: Number.isFinite(duration) ? duration : 0,
    provider: "duffel",
    raw: offer, // útil para debug
  };
}

async function duffelFetchWithRetry(url: string, body: unknown, timeoutMs: number): Promise<any> {
  const token = getEnv("DUFFEL_API_KEY");
  if (!token) throw new Error("DUFFEL_API_KEY missing");

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
          "Duffel-Version": "v2",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // 429 / 5xx: reintentar
      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxAttempts) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Duffel error ${res.status}: ${txt}`);
        }
        await sleep(250 * attempt * attempt);
        continue;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Duffel error ${res.status}: ${txt}`);
      }

      const data = await res.json().catch(async () => parseMaybeXmlOrJson(await res.text()));
      return data;
    } catch (err: any) {
      clearTimeout(timer);

      // timeout/abort -> retry
      const isAbort = err?.name === "AbortError";
      if ((isAbort || attempt < maxAttempts) && attempt < maxAttempts) {
        await sleep(250 * attempt * attempt);
        continue;
      }
      throw err;
    }
  }

  throw new Error("Duffel request failed");
}

export const duffelProvider: FlightsProvider = {
  id: "duffel",

  async search(req: ProviderSearchRequest): Promise<ProviderSearchResponse> {
    const timeoutMs = Number(getEnv("DUFFEL_TIMEOUT_MS") ?? "8000");

    // si no hay API key, no rompas el search:
    if (!getEnv("DUFFEL_API_KEY")) return req.legs.map((_, i) => ({ legIndex: i, flights: [] }));

    const results: ProviderSearchResponse = [];

    for (let i = 0; i < req.legs.length; i++) {
      const leg = req.legs[i];

      // Duffel usa "slices" y "passengers"
      const duffelBody = {
        data: {
          slices: [
            {
              origin: leg.origin,
              destination: leg.destination,
              departure_date: leg.departure_date,
            },
          ],
          passengers: Array.from({ length: req.passengers }).map(() => ({ type: "adult" })),
        },
      };

      // endpoint: POST /air/offer_requests :contentReference[oaicite:8]{index=8}
      const url = `${DUFFEL_BASE_URL}/air/offer_requests?return_offers=true`;

      const response = await duffelFetchWithRetry(url, duffelBody, Number.isFinite(timeoutMs) ? timeoutMs : 8000);

      const offers = response?.data?.offers ?? [];
      const flights = Array.isArray(offers) ? offers.slice(0, 20).map(toFlightFromDuffelOffer) : [];

      results.push({ legIndex: i, flights });
    }

    return results;
  },
};
