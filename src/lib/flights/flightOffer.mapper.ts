// src/lib/flights/flightOffer.mapper.ts
import type { FlightOffer, FlightSegment } from "@/types/models";

function formatDurationFromMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDurationFromDates(departureISO: string, arrivalISO: string): string {
  const dep = new Date(departureISO).getTime();
  const arr = new Date(arrivalISO).getTime();
  const ms = arr - dep;
  const minutes = Math.max(0, Math.round(ms / 60000));
  return formatDurationFromMinutes(minutes);
}

function gstaticLogo(iataCode?: string): string | undefined {
  if (!iataCode) return undefined;
  return `https://www.gstatic.com/flights/airline_logos/70px/${iataCode}.png`;
}

/**
 * Convierte 1 segmento de Duffel (raw) al FlightSegment de tu UI.
 */
function toUiSegment(seg: any, offerId: string, index: number): FlightSegment {
  const marketing = seg?.marketing_carrier ?? seg?.operating_carrier ?? {};
  const code: string = marketing?.iata_code ?? seg?.marketing_carrier_iata_code ?? "";

  const dep = seg?.departing_at ?? "";
  const arr = seg?.arriving_at ?? "";
  const duration =
    typeof seg?.duration === "number"
      ? formatDurationFromMinutes(seg.duration)
      : dep && arr
        ? formatDurationFromDates(dep, arr)
        : "—";

  const flightNumberRaw =
    seg?.marketing_carrier_flight_number ??
    seg?.operating_carrier_flight_number ??
    seg?.flight_number ??
    "";

  const flightNumber = String(flightNumberRaw || "").trim();

  const logoUrl =
    marketing?.logo_symbol_url ??
    marketing?.logo_url ??
    seg?.airline_logo_url ??
    gstaticLogo(code);

  return {
    id: `${offerId}-seg-${index + 1}`,
    origin: seg?.origin?.iata_code ?? seg?.origin_iata_code ?? "",
    destination: seg?.destination?.iata_code ?? seg?.destination_iata_code ?? "",
    departureTime: dep,
    arrivalTime: arr,
    flightNumber: flightNumber || "—",
    duration,
    airline: {
      id: code || "UNKNOWN",
      name: marketing?.name ?? "Aerolínea",
      code: code || "",
      logoUrl,
    },
  };
}

/**
 * Convierte el objeto "flight" que llega del backend (DB o Duffel raw)
 * a FlightOffer para UI.
 */
export function mapApiFlightToOffer(f: any): FlightOffer {
  const offerId: string = String(f?.id ?? f?.offerId ?? crypto.randomUUID());

  // ✅ Si viene Duffel raw, trae segmentos reales aquí:
  const rawSegments: any[] = f?.raw?.slices?.[0]?.segments ?? [];

  // ✅ Detectar cantidad de segmentos cuando NO viene raw (para no marcar "Directo" por error)
  const segmentsCountFromApi =
    Number.isFinite(Number(f?.segments_count)) ? Number(f.segments_count) : null;

  const stopsNumberFromApi =
    Number.isFinite(Number(f?.stops)) ? Number(f.stops) : null;

  const placeholderSegmentsCount =
    segmentsCountFromApi && segmentsCountFromApi > 0
      ? segmentsCountFromApi
      : stopsNumberFromApi != null
        ? Math.max(1, stopsNumberFromApi + 1)
        : 1;

  // Fallback: si el backend devuelve FlightWithDetails “DB” (1 vuelo)
  const fallbackDeparture = f?.departure_datetime ?? f?.departureTime ?? "";
  const fallbackArrival = f?.arrival_datetime ?? f?.arrivalTime ?? "";
  const fallbackDuration =
    fallbackDeparture && fallbackArrival
      ? formatDurationFromDates(fallbackDeparture, fallbackArrival)
      : "—";

  const origin = f?.origin_airport?.iata_code ?? f?.origin ?? "";
  const destination = f?.destination_airport?.iata_code ?? f?.destination ?? "";

  const airlineId = f?.airline?.id ?? f?.airline_id ?? "UNKNOWN";
  const airlineCode = f?.airline?.iata_code ?? "";
  const airlineName = f?.airline?.name ?? "Aerolínea";
  const airlineLogo = f?.airline?.logo_url ?? gstaticLogo(airlineCode);

  const flightNumber = f?.flight_number ?? f?.flightNumber ?? "—";

  const segments: FlightSegment[] =
    Array.isArray(rawSegments) && rawSegments.length > 0
      ? rawSegments.map((s, i) => toUiSegment(s, offerId, i))
      : Array.from({ length: placeholderSegmentsCount }).map((_, i) => ({
          id: `${offerId}-seg-${i + 1}`,
          // primer segmento con origin real, último con destination real, intermedios placeholder
          origin: i === 0 ? origin : "—",
          destination: i === placeholderSegmentsCount - 1 ? destination : "—",
          departureTime: fallbackDeparture,
          arrivalTime: fallbackArrival,
          flightNumber,
          duration: fallbackDuration,
          airline: {
            id: airlineId,
            name: airlineName,
            code: airlineCode,
            logoUrl: airlineLogo,
          },
        }));

  const totalDuration =
    segments.length > 0
      ? (() => {
          const first = segments[0];
          const last = segments[segments.length - 1];
          if (first?.departureTime && last?.arrivalTime) {
            return formatDurationFromDates(first.departureTime, last.arrivalTime);
          }
          return segments.map((s) => s.duration).filter(Boolean)[0] ?? "—";
        })()
      : "—";

  return {
    id: offerId,
    price: Number(f?.final_price ?? f?.price ?? 0),
    currency: String(f?.currency ?? "USD"),
    segments,
    totalDuration,
    type: "oneway",
  };
}
