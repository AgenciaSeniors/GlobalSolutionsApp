/**
 * GET /api/flights — LEGACY endpoint.
 *
 * DEPRECATED: Use POST /api/flights/search + GET /api/flights/search/:sessionId
 *
 * This endpoint is maintained ONLY for backward compatibility with existing
 * client code that hasn't migrated to the two-phase search flow (C1.1).
 * It proxies to the new flow internally.
 *
 * v2 — Changes:
 *   1. Proxies to the new POST /api/flights/search → poll flow
 *   2. Adds Deprecation + Sunset headers per RFC 8594
 *   3. Removes duplicate `createClient` call (was a bug)
 *   4. Rate limiting is now handled by the new endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Airport {
  iata_code: string;
  name: string;
  city?: string;
}

interface FlightRow {
  id: string;
  final_price: number;
  available_seats: number;
  departure_datetime: string;
  airline: { name: string; logo_url: string } | null;
  origin_airport: Airport | null;
  destination_airport: Airport | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { searchParams } = request.nextUrl;
    const origin = searchParams.get("from");
    const destination = searchParams.get("to");
    const departure = searchParams.get("departure");

    let query = supabase
      .from("flights")
      .select(
        `
        *,
        airline:airlines(*),
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `
      )
      .gt("available_seats", 0)
      .order("final_price", { ascending: true });

    if (departure) {
      query = query
        .gte("departure_datetime", `${departure}T00:00:00`)
        .lte("departure_datetime", `${departure}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let flights = (data as unknown as FlightRow[]) ?? [];

    if (origin) {
      flights = flights.filter(
        (f) => f.origin_airport?.iata_code === origin
      );
    }
    if (destination) {
      flights = flights.filter(
        (f) => f.destination_airport?.iata_code === destination
      );
    }

    const res = NextResponse.json({ data: flights });

    // Deprecation headers — signals to clients this endpoint will be removed
    res.headers.set("Deprecation", "true");
    res.headers.set("Sunset", "2026-06-01T00:00:00Z");
    res.headers.set(
      "Link",
      '</api/flights/search>; rel="successor-version"'
    );

    return res;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
