export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateBookingTotal,
  getPassengerPricingDetails,
  type PaymentGateway,
} from "@/lib/pricing/bookingPricing";

// Validation schema for request body
const PreviewRequestSchema = z.object({
  booking_id: z.string().uuid(),
  gateway: z.enum(["stripe", "paypal"]),
});

// Type for parsed passenger rows
interface PassengerRow {
  date_of_birth: string;
}

// Type for parsed flight row
interface FlightRow {
  id: string;
  final_price: number;
}

// Type for parsed booking row
interface BookingRow {
  id: string;
  user_id: string | null;
  flight_id: string | null;
  currency: string;
  payment_status: string | null;
}

/**
 * Helper to parse unknown values safely
 */
function parseString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id);
  const currency = parseString(value.currency) ?? "USD";
  const user_id = value.user_id === null ? null : parseString(value.user_id);
  const flight_id = value.flight_id === null ? null : parseString(value.flight_id);
  const payment_status = value.payment_status === null ? null : parseString(value.payment_status);

  if (!id) return null;
  return { id, user_id, flight_id, currency, payment_status };
}

function parseFlightRow(value: unknown): FlightRow | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id);
  const final_price = parseNumber(value.final_price);

  if (!id || final_price === null) return null;
  return { id, final_price };
}

function parsePassengerRows(value: unknown): PassengerRow[] | null {
  if (!Array.isArray(value)) return null;

  const out: PassengerRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const dob = parseString(item.date_of_birth);
    if (!dob) return null;
    out.push({ date_of_birth: dob });
  }
  return out;
}

/**
 * POST /api/bookings/preview
 * 
 * Calculates the price breakdown for a booking based on the selected payment gateway.
 * This is the SOURCE OF TRUTH for pricing - the frontend NEVER calculates prices.
 * 
 * Request body:
 * - booking_id: UUID of the booking
 * - gateway: 'stripe' | 'paypal'
 * 
 * Response:
 * - gateway: The selected gateway
 * - breakdown: Full price breakdown
 * - passengers: Array of passenger pricing details
 * - base_price: The base flight price per adult
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1) Parse and validate request body
    const body: unknown = await req.json();
    const parsed = PreviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { booking_id, gateway } = parsed.data;

    // 2) Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 3) Fetch booking with service role
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, flight_id, currency, payment_status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !bookingData) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const booking = parseBookingRow(bookingData);
    if (!booking) {
      return NextResponse.json(
        { error: "Invalid booking data" },
        { status: 500 }
      );
    }

    // 4) Verify ownership
    if (booking.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - You don't own this booking" },
        { status: 403 }
      );
    }

    // 5) Check booking can be paid
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { error: "Booking is already paid" },
        { status: 409 }
      );
    }

    if (!booking.flight_id) {
      return NextResponse.json(
        { error: "Booking has no flight selected" },
        { status: 400 }
      );
    }

    // 6) Validate currency (USD only for now)
    if (booking.currency !== "USD") {
      return NextResponse.json(
        { error: `Unsupported currency: ${booking.currency}. Only USD is supported.` },
        { status: 400 }
      );
    }

    // 7) Fetch flight details
    const { data: flightData, error: flightError } = await supabaseAdmin
      .from("flights")
      .select("id, final_price")
      .eq("id", booking.flight_id)
      .single();

    if (flightError || !flightData) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    const flight = parseFlightRow(flightData);
    if (!flight) {
      return NextResponse.json(
        { error: "Invalid flight data" },
        { status: 500 }
      );
    }

    // 8) Fetch passengers
    const { data: passengersData, error: passengersError } = await supabaseAdmin
      .from("booking_passengers")
      .select("date_of_birth")
      .eq("booking_id", booking.id);

    if (passengersError || !passengersData) {
      return NextResponse.json(
        { error: "Failed to fetch passengers" },
        { status: 500 }
      );
    }

    const passengers = parsePassengerRows(passengersData);
    if (!passengers || passengers.length === 0) {
      return NextResponse.json(
        { error: "No passengers found for this booking" },
        { status: 400 }
      );
    }

    // 9) Calculate pricing using the business logic engine
    const breakdown = calculateBookingTotal(
      flight.final_price,
      passengers,
      gateway as PaymentGateway
    );

    // 10) Get detailed passenger breakdown
    const passengerDetails = getPassengerPricingDetails(
      flight.final_price,
      passengers
    );

    // 11) Return complete pricing information
    return NextResponse.json({
      gateway,
      breakdown,
      passengers: passengerDetails,
      base_price: flight.final_price,
    });

  } catch (error) {
    console.error("[Booking Preview] Error:", error);
    
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
