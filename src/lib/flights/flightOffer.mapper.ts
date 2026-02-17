// src/lib/flights/flightOffer.mapper.ts
import type { FlightOffer, FlightSegment } from "@/types/models";

/* ------------------------------------------------------------------ */
/*  Input shape interfaces (replaces all `any`)                        */
/* ------------------------------------------------------------------ */

/** Airline object as it may appear in different sources */
interface InputAirline {
  id?: string;
  iata_code?: string;
  name?: string;
  logo_url?: string | null;
  logo_symbol_url?: string | null;
}

/** Airport object as it may appear in different sources */
interface InputAirport {
  iata_code?: string;
  name?: string;
}

/** Duffel raw carrier */
interface DuffelCarrier {
  iata_code?: string;
  name?: string;
  logo_symbol_url?: string;
  logo_url?: string;
}

/** Duffel raw segment */
interface DuffelSegment {
  marketing_carrier?: DuffelCarrier;
  operating_carrier?: DuffelCarrier;
  marketing_carrier_iata_code?: string;
  marketing_carrier_flight_number?: string;
  operating_carrier_flight_number?: string;
  flight_number?: string;
  departing_at?: string;
  arriving_at?: string;
  duration?: number;
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  origin_iata_code?: string;
  destination_iata_code?: string;
  airline_logo_url?: string;
}

/** SkyScrapper segment (from skyScrapperProvider v5) */
interface SkySegment {
  origin_iata: string;
  origin_name: string;
  destination_iata: string;
  destination_name: string;
  departure: string;
  arrival: string;
  duration_minutes: number;
  flight_number: string;
  airline_name: string;
  airline_code: string;
  airline_logo_url: string | null;
}

/** DB stop entry */
interface StopEntry {
  airport?: string;
  duration_minutes?: number;
  order?: number;
  airport_iata?: string;
}

/**
 * Union of all possible flight shapes that arrive at the mapper.
 * Covers: DB FlightWithDetails, SkyScrapper provider output, Duffel raw,
 * and the external-stub provider.
 */
interface InputFlight {
  id?: string;
  offerId?: string;
  price?: number;
  final_price?: number;
  currency?: string;

  departure_datetime?: string;
  departureTime?: string;
  arrival_datetime?: string;
  arrivalTime?: string;

  airline?: InputAirline;
  airline_id?: string;
  airline_code?: string;

  origin_airport?: InputAirport;
  destination_airport?: InputAirport;
  origin_iata?: string;
  destination_iata?: string;
  origin?: string;
  destination?: string;

  flight_number?: string;
  flightNumber?: string;

  is_exclusive_offer?: boolean;
  provider?: string;
  offerSource?: string;

  stops?: StopEntry[] | null;
  stops_count?: number;
  segments_count?: number;

  // Duffel raw
  raw?: {
    slices?: Array<{
      segments?: DuffelSegment[];
    }>;
  };

  // SkyScrapper v5 segments
  sky_segments?: SkySegment[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/* ------------------------------------------------------------------ */
/*  Duration helpers                                                   */
/* ------------------------------------------------------------------ */

function formatDurationFromMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDurationFromDates(
  departureISO: string,
  arrivalISO: string
): string {
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

/* ------------------------------------------------------------------ */
/*  Duffel segment mapper                                              */
/* ------------------------------------------------------------------ */

function toUiSegment(
  seg: DuffelSegment,
  offerId: string,
  index: number
): FlightSegment {
  const marketing = seg.marketing_carrier ?? seg.operating_carrier;
  const code: string =
    marketing?.iata_code ?? seg.marketing_carrier_iata_code ?? "";

  const dep = seg.departing_at ?? "";
  const arr = seg.arriving_at ?? "";
  const duration =
    typeof seg.duration === "number"
      ? formatDurationFromMinutes(seg.duration)
      : dep && arr
        ? formatDurationFromDates(dep, arr)
        : "—";

  const flightNumberRaw =
    seg.marketing_carrier_flight_number ??
    seg.operating_carrier_flight_number ??
    seg.flight_number ??
    "";
  const flightNumber = String(flightNumberRaw || "").trim();

  const logoUrl =
    marketing?.logo_symbol_url ??
    marketing?.logo_url ??
    seg.airline_logo_url ??
    gstaticLogo(code);

  return {
    id: `${offerId}-seg-${index + 1}`,
    origin: seg.origin?.iata_code ?? seg.origin_iata_code ?? "",
    destination: seg.destination?.iata_code ?? seg.destination_iata_code ?? "",
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

/* ------------------------------------------------------------------ */
/*  SkyScrapper segment mapper                                         */
/* ------------------------------------------------------------------ */

function skySegmentToUi(
  skySeg: SkySegment,
  offerId: string,
  index: number
): FlightSegment {
  const code = skySeg.airline_code;
  const logoUrl = skySeg.airline_logo_url ?? gstaticLogo(code);

  const dep = skySeg.departure;
  const arr = skySeg.arrival;

  const duration =
    skySeg.duration_minutes > 0
      ? formatDurationFromMinutes(skySeg.duration_minutes)
      : dep && arr
        ? formatDurationFromDates(dep, arr)
        : "—";

  return {
    id: `${offerId}-seg-${index + 1}`,
    origin: skySeg.origin_iata,
    destination: skySeg.destination_iata,
    departureTime: dep,
    arrivalTime: arr,
    flightNumber: skySeg.flight_number || "—",
    duration,
    airline: {
      id: code || "UNKNOWN",
      name: skySeg.airline_name,
      code,
      logoUrl,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Main mapper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Convierte el objeto "flight" que llega del backend (DB, Duffel raw, o SkyScrapper)
 * a FlightOffer para la UI. Fully typed — no `any`.
 */
export function mapApiFlightToOffer(input: unknown): FlightOffer {
  // Safe cast: input comes from JSON, we validate fields individually
  const f: InputFlight = isRecord(input) ? (input as InputFlight) : {};

  const offerId: string = String(
    f.id ?? f.offerId ?? crypto.randomUUID()
  );

  // ── Source 1: SkyScrapper segments (v5) ──
  const skySegments: SkySegment[] = Array.isArray(f.sky_segments)
    ? f.sky_segments
    : [];

  // ── Source 2: Duffel raw segments ──
  const rawSegments: DuffelSegment[] =
    f.raw?.slices?.[0]?.segments ?? [];

  // ── Source 3: DB stops data ──
  const stopsFromDb: StopEntry[] = Array.isArray(f.stops) ? f.stops : [];

  // Segment count heuristics for DB fallback
  const segmentsCountFromStops = stopsFromDb.length + 1;
  const segmentsCountFromApi =
    Number.isFinite(Number(f.segments_count))
      ? Number(f.segments_count)
      : null;
  const stopsNumberFromApi =
    Number.isFinite(Number(f.stops_count))
      ? Number(f.stops_count)
      : null;

  const placeholderSegmentsCount =
    stopsFromDb.length > 0
      ? segmentsCountFromStops
      : segmentsCountFromApi != null && segmentsCountFromApi > 0
        ? segmentsCountFromApi
        : stopsNumberFromApi != null
          ? Math.max(1, stopsNumberFromApi + 1)
          : 1;

  // Common flight-level data
  const fallbackDeparture = f.departure_datetime ?? f.departureTime ?? "";
  const fallbackArrival = f.arrival_datetime ?? f.arrivalTime ?? "";
  const fallbackDuration =
    fallbackDeparture && fallbackArrival
      ? formatDurationFromDates(fallbackDeparture, fallbackArrival)
      : "—";

  const origin =
    f.origin_airport?.iata_code ?? f.origin_iata ?? f.origin ?? "";
  const destination =
    f.destination_airport?.iata_code ??
    f.destination_iata ??
    f.destination ??
    "";

  const airlineId = f.airline?.id ?? f.airline_id ?? "UNKNOWN";
  const airlineCode = f.airline?.iata_code ?? f.airline_code ?? "";
  const airlineName = f.airline?.name ?? "Aerolínea";
  const airlineLogo = f.airline?.logo_url ?? gstaticLogo(airlineCode);

  const flightNumber = f.flight_number ?? f.flightNumber ?? "—";

  // ── BUILD SEGMENTS (priority: sky > duffel > db fallback) ──
  let segments: FlightSegment[];

  if (skySegments.length > 0) {
    segments = skySegments.map((s, i) => skySegmentToUi(s, offerId, i));
  } else if (rawSegments.length > 0) {
    segments = rawSegments.map((s, i) => toUiSegment(s, offerId, i));
  } else {
    // DB fallback: synthesize segments from stops data
    segments = Array.from({ length: placeholderSegmentsCount }).map(
      (_, i) => {
        const isFirstSegment = i === 0;
        const isLastSegment = i === placeholderSegmentsCount - 1;

        let segmentOrigin = "—";
        let segmentDestination = "—";

        if (isFirstSegment) {
          segmentOrigin = origin;
          segmentDestination = stopsFromDb[0]?.airport ?? destination;
        } else if (isLastSegment) {
          segmentOrigin = stopsFromDb[i - 1]?.airport ?? origin;
          segmentDestination = destination;
        } else {
          segmentOrigin = stopsFromDb[i - 1]?.airport ?? "—";
          segmentDestination = stopsFromDb[i]?.airport ?? "—";
        }

        let segmentDeparture = fallbackDeparture;
        let segmentArrival = fallbackArrival;
        let segmentDuration = fallbackDuration;

        if (
          fallbackDeparture &&
          fallbackArrival &&
          stopsFromDb.length > 0
        ) {
          const totalDepTime = new Date(fallbackDeparture).getTime();

          if (isFirstSegment && stopsFromDb[0]?.duration_minutes) {
            const stopDuration =
              stopsFromDb[0].duration_minutes * 60000;
            segmentDeparture = fallbackDeparture;
            segmentArrival = new Date(
              totalDepTime + stopDuration
            ).toISOString();
            segmentDuration = formatDurationFromDates(
              segmentDeparture,
              segmentArrival
            );
          } else if (isLastSegment) {
            const previousStops = stopsFromDb.slice(0, i);
            const previousDuration = previousStops.reduce(
              (sum: number, stop: StopEntry) =>
                sum + (stop.duration_minutes ?? 0) * 60000,
              0
            );
            segmentDeparture = new Date(
              totalDepTime + previousDuration
            ).toISOString();
            segmentArrival = fallbackArrival;
            segmentDuration = formatDurationFromDates(
              segmentDeparture,
              segmentArrival
            );
          } else {
            const previousStops = stopsFromDb.slice(0, i);
            const currentStop = stopsFromDb[i];
            const previousDuration = previousStops.reduce(
              (sum: number, stop: StopEntry) =>
                sum + (stop.duration_minutes ?? 0) * 60000,
              0
            );
            const currentDuration =
              (currentStop?.duration_minutes ?? 0) * 60000;
            segmentDeparture = new Date(
              totalDepTime + previousDuration
            ).toISOString();
            segmentArrival = new Date(
              totalDepTime + previousDuration + currentDuration
            ).toISOString();
            segmentDuration = formatDurationFromDates(
              segmentDeparture,
              segmentArrival
            );
          }
        }

        return {
          id: `${offerId}-seg-${i + 1}`,
          origin: segmentOrigin,
          destination: segmentDestination,
          departureTime: segmentDeparture,
          arrivalTime: segmentArrival,
          flightNumber,
          duration: segmentDuration,
          airline: {
            id: airlineId,
            name: airlineName,
            code: airlineCode,
            logoUrl: airlineLogo,
          },
        };
      }
    );
  }

  // ── Total duration ──
  const totalDuration =
    segments.length > 0
      ? (() => {
          const first = segments[0];
          const last = segments[segments.length - 1];
          if (first?.departureTime && last?.arrivalTime) {
            return formatDurationFromDates(
              first.departureTime,
              last.arrivalTime
            );
          }
          return (
            segments
              .map((s) => s.duration)
              .filter(Boolean)[0] ?? "—"
          );
        })()
      : "—";

  return {
    id: offerId,
    price: Number(f.final_price ?? f.price ?? 0),
    currency: String(f.currency ?? "USD"),
    segments,
    totalDuration,
    type: "oneway",
    airline_code: airlineCode || undefined,
    stops_count: Math.max(0, segments.length - 1),
    stops: Array.isArray(f.stops)
      ? f.stops.map((s) => ({
          airport: s.airport ?? "",
          duration_minutes: s.duration_minutes ?? 0,
        }))
      : undefined,
    is_exclusive_offer: Boolean(f.is_exclusive_offer),
    provider: String(f.provider ?? f.offerSource ?? ""),
  };
}