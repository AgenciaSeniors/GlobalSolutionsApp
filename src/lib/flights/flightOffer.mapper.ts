// src/lib/flights/flightOffer.mapper.ts
import type { FlightOffer, FlightSegment } from "@/types/models";

interface InputAirline { id?: string; iata_code?: string; name?: string; logo_url?: string | null; logo_symbol_url?: string | null; }
interface InputAirport { iata_code?: string; name?: string; }
interface DuffelCarrier { iata_code?: string; name?: string; logo_symbol_url?: string; logo_url?: string; }
interface DuffelSegment { marketing_carrier?: DuffelCarrier; operating_carrier?: DuffelCarrier; marketing_carrier_iata_code?: string; marketing_carrier_flight_number?: string; operating_carrier_flight_number?: string; flight_number?: string; departing_at?: string; arriving_at?: string; duration?: number; origin?: { iata_code?: string }; destination?: { iata_code?: string }; origin_iata_code?: string; destination_iata_code?: string; airline_logo_url?: string; }
interface SkySegment { origin_iata: string; origin_name: string; destination_iata: string; destination_name: string; departure: string; arrival: string; duration_minutes: number; flight_number: string; airline_name: string; airline_code: string; airline_logo_url: string | null; }
interface StopEntry { airport?: string; duration_minutes?: number; }

interface InputFlight {
  id?: string; offerId?: string; price?: number; final_price?: number; currency?: string;
  departure_datetime?: string; departureTime?: string; arrival_datetime?: string; arrivalTime?: string;
  airline?: InputAirline; airline_id?: string; airline_code?: string;
  origin_airport?: InputAirport; destination_airport?: InputAirport;
  origin_iata?: string; destination_iata?: string; origin?: string; destination?: string;
  flight_number?: string; flightNumber?: string;
  is_exclusive_offer?: boolean; provider?: string; offerSource?: string;
  stops?: StopEntry[] | null; stops_count?: number; segments_count?: number;
  raw?: { slices?: Array<{ segments?: DuffelSegment[] }> };
  sky_segments?: SkySegment[];
}

function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }

function formatDurationFromMinutes(m: number): string { const mins = Math.max(0, Math.round(m)); const h = Math.floor(mins / 60); const mm = mins % 60; if (h <= 0) return `${mm}m`; if (mm === 0) return `${h}h`; return `${h}h ${mm}m`; }
function formatDurationFromDates(dep: string, arr: string): string { const ms = new Date(arr).getTime() - new Date(dep).getTime(); return formatDurationFromMinutes(Math.max(0, Math.round(ms / 60000))); }
function gstaticLogo(code?: string): string | undefined { return code ? `https://www.gstatic.com/flights/airline_logos/70px/${code}.png` : undefined; }

function toUiSegment(seg: DuffelSegment, offerId: string, i: number): FlightSegment {
  const m = seg.marketing_carrier ?? seg.operating_carrier;
  const code = m?.iata_code ?? seg.marketing_carrier_iata_code ?? "";
  const dep = seg.departing_at ?? ""; const arr = seg.arriving_at ?? "";
  const dur = typeof seg.duration === "number" ? formatDurationFromMinutes(seg.duration) : dep && arr ? formatDurationFromDates(dep, arr) : "—";
  const fn = String(seg.marketing_carrier_flight_number ?? seg.operating_carrier_flight_number ?? seg.flight_number ?? "").trim();
  const logo = m?.logo_symbol_url ?? m?.logo_url ?? seg.airline_logo_url ?? gstaticLogo(code);
  return { id: `${offerId}-seg-${i + 1}`, origin: seg.origin?.iata_code ?? seg.origin_iata_code ?? "", destination: seg.destination?.iata_code ?? seg.destination_iata_code ?? "", departureTime: dep, arrivalTime: arr, flightNumber: fn || "—", duration: dur, airline: { id: code || "UNKNOWN", name: m?.name ?? "Aerolínea", code: code || "", logoUrl: logo } };
}

function skySegmentToUi(s: SkySegment, offerId: string, i: number): FlightSegment {
  const logo = s.airline_logo_url ?? gstaticLogo(s.airline_code);
  const dur = s.duration_minutes > 0 ? formatDurationFromMinutes(s.duration_minutes) : s.departure && s.arrival ? formatDurationFromDates(s.departure, s.arrival) : "—";
  return { id: `${offerId}-seg-${i + 1}`, origin: s.origin_iata, destination: s.destination_iata, departureTime: s.departure, arrivalTime: s.arrival, flightNumber: s.flight_number || "—", duration: dur, airline: { id: s.airline_code || "UNKNOWN", name: s.airline_name, code: s.airline_code, logoUrl: logo } };
}

export function mapApiFlightToOffer(
  input: unknown,
  context?: { tripType?: 'oneway' | 'roundtrip' | 'multicity' },
): FlightOffer {
  const f: InputFlight = isRecord(input) ? (input as InputFlight) : {};
  const offerId = String(f.id ?? f.offerId ?? crypto.randomUUID());

  const skySegs: SkySegment[] = Array.isArray(f.sky_segments) ? f.sky_segments : [];
  const rawSegs: DuffelSegment[] = f.raw?.slices?.[0]?.segments ?? [];
  const stopsDb: StopEntry[] = Array.isArray(f.stops) ? f.stops : [];

  const fallbackDep = f.departure_datetime ?? f.departureTime ?? "";
  const fallbackArr = f.arrival_datetime ?? f.arrivalTime ?? "";
  const fallbackDur = fallbackDep && fallbackArr ? formatDurationFromDates(fallbackDep, fallbackArr) : "—";

  const origin = f.origin_airport?.iata_code ?? f.origin_iata ?? f.origin ?? "";
  const destination = f.destination_airport?.iata_code ?? f.destination_iata ?? f.destination ?? "";
  const airlineId = f.airline?.id ?? f.airline_id ?? "UNKNOWN";
  const airlineCode = f.airline?.iata_code ?? f.airline_code ?? "";
  const airlineName = f.airline?.name ?? "Aerolínea";
  const airlineLogo = f.airline?.logo_url ?? gstaticLogo(airlineCode);
  const flightNumber = f.flight_number ?? f.flightNumber ?? "—";

  const stopsNumberFromApi = Number.isFinite(Number(f.stops_count)) ? Number(f.stops_count) : null;
  const placeholderCount = stopsDb.length > 0 ? stopsDb.length + 1 : stopsNumberFromApi != null ? Math.max(1, stopsNumberFromApi + 1) : 1;

  let segments: FlightSegment[];

  if (skySegs.length > 0) {
    segments = skySegs.map((s, i) => skySegmentToUi(s, offerId, i));
  } else if (rawSegs.length > 0) {
    segments = rawSegs.map((s, i) => toUiSegment(s, offerId, i));
  } else {
    segments = Array.from({ length: placeholderCount }).map((_, i) => {
      const isFirst = i === 0; const isLast = i === placeholderCount - 1;
      let segOrigin = "—", segDest = "—";
      if (isFirst) { segOrigin = origin; segDest = stopsDb[0]?.airport ?? destination; }
      else if (isLast) { segOrigin = stopsDb[i - 1]?.airport ?? origin; segDest = destination; }
      else { segOrigin = stopsDb[i - 1]?.airport ?? "—"; segDest = stopsDb[i]?.airport ?? "—"; }
      return { id: `${offerId}-seg-${i + 1}`, origin: segOrigin, destination: segDest, departureTime: fallbackDep, arrivalTime: fallbackArr, flightNumber, duration: fallbackDur, airline: { id: airlineId, name: airlineName, code: airlineCode, logoUrl: airlineLogo } };
    });
  }

  const totalDuration = segments.length > 0 ? (() => { const first = segments[0]; const last = segments[segments.length - 1]; return first?.departureTime && last?.arrivalTime ? formatDurationFromDates(first.departureTime, last.arrivalTime) : "—"; })() : "—";

  return {
    id: offerId, price: Number(f.final_price ?? f.price ?? 0), currency: String(f.currency ?? "USD"),
    segments, totalDuration, type: context?.tripType ?? "oneway",
    airline_code: airlineCode || undefined, stops_count: Math.max(0, segments.length - 1),
    stops: Array.isArray(f.stops) ? f.stops.map((s) => ({ airport: s.airport ?? "", duration_minutes: s.duration_minutes ?? 0 })) : undefined,
    is_exclusive_offer: Boolean(f.is_exclusive_offer), provider: String(f.provider ?? f.offerSource ?? ""),
  };
}