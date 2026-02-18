/**
 * POST /api/flights/persist
 * Persists a selected FlightOffer into `public.flights` and returns the DB uuid.
 *
 * This is needed because the flight search provider uses non-uuid ids, while
 * `bookings.flight_id` is a FK to `flights.id` (uuid).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type FlightOffer = {
  id: string;
  price: number;
  currency: string;
  segments: Array<{
    origin?: string;
    destination?: string;
    departureTime?: string;
    arrivalTime?: string;
    airline?: { code?: string; name?: string } | null;
    flightNumber?: string;
  }>;
  provider?: string;
};

function isISODateTime(s: string | undefined): s is string {
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function safeFlightNumber(offer: FlightOffer): string {
  const first = offer.segments?.[0];
  const n = (first?.flightNumber || "").trim();
  if (n) return n.slice(0, 10);
  const airlineCode = (first?.airline?.code || "EXT").trim();
  // Create a short deterministic-ish label (<= 10 chars)
  const suffix = Math.abs(hashString(offer.id)).toString().slice(0, 4);
  return `${airlineCode}`.slice(0, 6) + suffix; // <= 10
}

function hashString(str: string): number {
  // tiny deterministic hash
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { offer?: FlightOffer; passengers?: number | null };
    const offer = body.offer;

    if (!offer || !Array.isArray(offer.segments) || offer.segments.length === 0) {
      return NextResponse.json({ error: "Missing or invalid offer" }, { status: 400 });
    }

    const first = offer.segments[0];
    const last = offer.segments[offer.segments.length - 1];

    if (!isISODateTime(first.departureTime) || !isISODateTime(last.arrivalTime)) {
      return NextResponse.json({ error: "Offer has invalid departure/arrival datetimes" }, { status: 400 });
    }

    const basePrice = Number(offer.price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: "Offer has invalid price" }, { status: 400 });
    }

    const passengers = Number(body.passengers ?? 1);
    const seats = Number.isFinite(passengers) && passengers > 0 ? Math.min(Math.max(passengers, 1), 9) : 1;

    const supabase = createAdminClient();

    // Insert a flight row. We don't have a provider_key column in schema, so we store only
    // what the schema requires; this row exists primarily to provide a uuid for FK.
    const flight_number = safeFlightNumber(offer);

    const { data, error } = await supabase
      .from("flights")
      .insert({
        flight_number,
        departure_datetime: first.departureTime,
        arrival_datetime: last.arrivalTime,
        base_price: basePrice,
        total_seats: Math.max(seats, 1),
        available_seats: Math.max(seats, 1),
        aircraft_type: null,
        is_exclusive_offer: Boolean((offer as any).is_exclusive_offer ?? false),
        offer_expires_at: null,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to persist flight" },
        { status: 500 }
      );
    }

    return NextResponse.json({ flight_id: data.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}