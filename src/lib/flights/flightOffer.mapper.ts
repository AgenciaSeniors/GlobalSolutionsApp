// src/lib/flights/flightOffer.mapper.ts
import type { FlightOffer, FlightSegment } from "@/types/models";

interface InputAirline { id?: string; iata_code?: string; name?: string; logo_url?: string | null; logo_symbol_url?: string | null; }
interface InputAirport { iata_code?: string; name?: string; }
interface DuffelCarrier { iata_code?: string; name?: string; logo_symbol_url?: string; logo_url?: string; }
interface DuffelSegment { marketing_carrier?: DuffelCarrier; operating_carrier?: DuffelCarrier; marketing_carrier_iata_code?: string; marketing_carrier_flight_number?: string; operating_carrier_flight_number?: string; flight_number?: string; departing_at?: string; arriving_at?: string; duration?: number; origin?: { iata_code?: string }; destination?: { iata_code?: string }; origin_iata_code?: string; destination_iata_code?: string; airline_logo_url?: string; }
interface SkySegment {
  origin_iata: string; origin_name: string; destination_iata: string; destination_name: string;
  departure: string; arrival: string; duration_minutes: number; flight_number: string;
  airline_name: string; airline_code: string; airline_logo_url: string | null;
  // Cuba-normalized fields added by skyScrapperProvider (optional for backward compat)
  departure_cuba?: string | null; arrival_cuba?: string | null;
  departure_utc?: string | null; arrival_utc?: string | null;
}
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
  // Use airport-local timestamps so departure shows the origin airport's local time
  // and arrival shows the destination airport's local time.
  const depTime = s.departure ?? s.departure_cuba;
  const arrTime = s.arrival ?? s.arrival_cuba;
  // Compute duration from UTC instants when available (avoids DST distortion).
  const dur = s.duration_minutes > 0
    ? formatDurationFromMinutes(s.duration_minutes)
    : s.departure_utc && s.arrival_utc
      ? formatDurationFromDates(s.departure_utc, s.arrival_utc)
      : depTime && arrTime
        ? formatDurationFromDates(depTime, arrTime)
        : "—";
  return { id: `${offerId}-seg-${i + 1}`, origin: s.origin_iata, destination: s.destination_iata, originName: s.origin_name, destinationName: s.destination_name, departureTime: depTime, arrivalTime: arrTime, flightNumber: s.flight_number || "—", duration: dur, airline: { id: s.airline_code || "UNKNOWN", name: s.airline_name, code: s.airline_code, logoUrl: logo } };
}

export function mapApiFlightToOffer(
  input: unknown,
  context?: { tripType?: 'oneway' | 'roundtrip' | 'multicity' },
): FlightOffer {
  const f: InputFlight = isRecord(input) ? (input as InputFlight) : {};
  const rawId = f.id ?? f.offerId;
  const offerId = rawId
    ? String(rawId)
    : `flight-${f.origin_iata ?? f.origin ?? ''}-${f.destination_iata ?? f.destination ?? ''}-${f.departure_datetime ?? f.departureTime ?? ''}-${String(f.final_price ?? f.price ?? 0)}`.replace(/\s+/g, '');

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

  const stopsNumberFromApi = (f.stops_count != null && Number.isFinite(Number(f.stops_count))) ? Number(f.stops_count) : null;
  const placeholderCount = stopsDb.length > 0
    ? stopsDb.length + 1
    : stopsNumberFromApi != null
      ? stopsNumberFromApi + 1  // 0 escalas → 1 segmento (directo), 1 escala → 2 segmentos, etc.
      : 1;

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

  // ── Compute totalDuration from the most reliable source available ──
  let totalDuration = "—";

  if (skySegs.length > 0) {
    // Strategy 1: Use UTC timestamps from first departure to last arrival (most accurate)
    const firstSky = skySegs[0];
    const lastSky = skySegs[skySegs.length - 1];

    if (firstSky.departure_utc && lastSky.arrival_utc) {
      totalDuration = formatDurationFromDates(firstSky.departure_utc, lastSky.arrival_utc);
    } else {
      // Strategy 2: Sum individual duration_minutes + layover time between segments
      let totalMinutes = 0;
      for (let i = 0; i < skySegs.length; i++) {
        totalMinutes += skySegs[i].duration_minutes || 0;
        if (i < skySegs.length - 1) {
          const curArr = skySegs[i].arrival_utc ?? skySegs[i].arrival;
          const nextDep = skySegs[i + 1].departure_utc ?? skySegs[i + 1].departure;
          if (curArr && nextDep) {
            const layoverMs = new Date(nextDep).getTime() - new Date(curArr).getTime();
            if (layoverMs > 0) totalMinutes += Math.round(layoverMs / 60000);
          }
        }
      }
      totalDuration = totalMinutes > 0 ? formatDurationFromMinutes(totalMinutes) : "—";
    }
  } else if (rawSegs.length > 0) {
    // Duffel segments have UTC offsets in departing_at/arriving_at
    const firstRaw = rawSegs[0];
    const lastRaw = rawSegs[rawSegs.length - 1];
    if (firstRaw.departing_at && lastRaw.arriving_at) {
      totalDuration = formatDurationFromDates(firstRaw.departing_at, lastRaw.arriving_at);
    }
  } else if (segments.length > 0) {
    // Fallback: use UI segment timestamps (original logic)
    const first = segments[0];
    const last = segments[segments.length - 1];
    totalDuration = first?.departureTime && last?.arrivalTime
      ? formatDurationFromDates(first.departureTime, last.arrivalTime)
      : "—";
  }

  // ── Compute arrivalDayDiff: how many calendar days later the flight arrives ──
  let arrivalDayDiff = 0;
  if (segments.length > 0) {
    const depTime = segments[0]?.departureTime;
    const arrTime = segments[segments.length - 1]?.arrivalTime;
    if (depTime && arrTime) {
      try {
        const depDate = new Date(depTime);
        const arrDate = new Date(arrTime);
        if (!isNaN(depDate.getTime()) && !isNaN(arrDate.getTime())) {
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Havana', year: 'numeric', month: '2-digit', day: '2-digit' });
          const depDay = fmt.format(depDate);
          const arrDay = fmt.format(arrDate);
          const depMs = new Date(depDay).getTime();
          const arrMs = new Date(arrDay).getTime();
          if (!isNaN(depMs) && !isNaN(arrMs)) {
            arrivalDayDiff = Math.round((arrMs - depMs) / 86400000);
          }
        }
      } catch { /* silently ignore timezone errors */ }
    }
  }

  return {
    id: offerId, price: Number(f.final_price ?? f.price ?? 0), currency: String(f.currency ?? "USD"),
    segments, totalDuration, arrivalDayDiff: arrivalDayDiff > 0 ? arrivalDayDiff : undefined,
    type: context?.tripType ?? "oneway",
    airline_code: airlineCode || undefined, stops_count: Math.max(0, segments.length - 1),
    stops: Array.isArray(f.stops) ? f.stops.map((s) => ({ airport: s.airport ?? "", duration_minutes: s.duration_minutes ?? 0 })) : undefined,
    is_exclusive_offer: Boolean(f.is_exclusive_offer), provider: String(f.provider ?? f.offerSource ?? ""),
  };
}