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
  const currency = String(offer?.total_currency ?? "USD");

  // Slice = tramo completo (puede tener múltiples segmentos)
  const slice = offer?.slices?.[0];
  const segments = slice?.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  // Calcular duración total del slice
  let durationMinutes = 0;
  if (slice?.duration) {
    // Formato ISO 8601: "PT2H30M" = 2 horas 30 minutos
    const match = String(slice.duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      durationMinutes = hours * 60 + minutes;
    }
  }

  // Extraer información del primer segmento (salida)
  const departureAirport = firstSegment?.origin;
  const departureDateTime = firstSegment?.departing_at;

  // Extraer información del último segmento (llegada)
  const arrivalAirport = lastSegment?.destination;
  const arrivalDateTime = lastSegment?.arriving_at;

  // Aerolínea (del primer segmento, es la operadora principal)
  const marketingCarrier = firstSegment?.marketing_carrier;
  const operatingCarrier = firstSegment?.operating_carrier;
  const carrier = marketingCarrier || operatingCarrier;

  // Flight number del primer segmento
  const flightNumber = firstSegment?.marketing_carrier_flight_number || 
                       firstSegment?.operating_carrier_flight_number || 
                       'N/A';

  // Número de paradas (segmentos - 1)
  const stops = Math.max(0, segments.length - 1);

  // Construir el objeto Flight con la estructura que espera el frontend
  return {
    // Campos base requeridos
    id: id || `duffel-${Math.random().toString(16).slice(2)}`,
    price: Number.isFinite(price) ? price : 0,
    duration: durationMinutes,
    provider: "duffel",
    
    // Campos adicionales que usa el frontend
    final_price: price,
    base_price: price, // Duffel no separa base de markup
    currency: currency,
    
    // Información de vuelo
    flight_number: flightNumber,
    departure_datetime: departureDateTime,
    arrival_datetime: arrivalDateTime,
    
    // Aerolínea
    airline: carrier ? {
      id: carrier.iata_code || carrier.id,
      iata_code: carrier.iata_code,
      name: carrier.name,
      logo_url: carrier.logo_symbol_url || carrier.logo_lockup_url,
    } : undefined,
    
    // Aeropuertos
    origin_airport: departureAirport ? {
      id: departureAirport.iata_code,
      iata_code: departureAirport.iata_code,
      name: departureAirport.name,
      city: departureAirport.city_name || departureAirport.city,
      country: departureAirport.iata_country_code,
      timezone: departureAirport.time_zone,
    } : undefined,
    
    destination_airport: arrivalAirport ? {
      id: arrivalAirport.iata_code,
      iata_code: arrivalAirport.iata_code,
      name: arrivalAirport.name,
      city: arrivalAirport.city_name || arrivalAirport.city,
      country: arrivalAirport.iata_country_code,
      timezone: arrivalAirport.time_zone,
    } : undefined,
    
    // Metadata
    available_seats: 9, // Duffel no siempre provee esto
    stops: stops,
    segments_count: segments.length,
    aircraft_type: firstSegment?.aircraft?.name || null,
    
    // Marcadores
    is_exclusive_offer: false, // Vuelos de Duffel no son exclusivos
    offerSource: 'external',
    
    // Raw data para debugging
    raw: offer,
    duffel_offer_id: offer.id, // Importante para hacer booking después
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
     console.log('🔍 [DUFFEL] API Key existe?', !!getEnv("DUFFEL_API_KEY"));
  console.log('🔍 [DUFFEL] Primeros 15 chars:', getEnv("DUFFEL_API_KEY")?.substring(0, 15) || 'NO ENCONTRADO');
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
      console.log('🔍 [DUFFEL] Response recibido:', {
  hasData: !!response?.data,
  hasOffers: !!response?.data?.offers,
  offersCount: response?.data?.offers?.length || 0
});

      const offers = response?.data?.offers ?? [];
      const flights = Array.isArray(offers) ? offers.slice(0, 20).map(toFlightFromDuffelOffer) : [];

      results.push({ legIndex: i, flights });
    }

    return results;
  },
};
