/**
 * Pricing Service - Module 2: Financial Infrastructure
 *
 * Orchestrates DB queries + deterministic priceEngine.
 * This file is the ONLY place that combines database data with pricing math.
 *
 * Flow:
 *  1. Fetch booking + passengers + flight from DB
 *  2. Build structured input (age multipliers, volatility, gateway fees)
 *  3. Delegate ALL math to priceEngine (pure function)
 *  4. Return typed breakdown
 *
 * IMPORTANT:
 * - priceEngine.ts stays pure (no DB calls, no side effects)
 * - Frontend NEVER calculates prices
 * - This service is server-only
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateBookingTotal,
  getPassengerPricingDetails,
  type PaymentGateway,
} from "@/lib/pricing/bookingPricing";
import type { FeePolicy, PriceBreakdown } from "@/lib/pricing/priceEngine";
import type { PassengerType } from "@/lib/pricing/passengerRules";

/* ───────────────────── Types ───────────────────── */

export interface BookingPricingResult {
  booking_id: string;
  gateway: PaymentGateway;
  breakdown: PriceBreakdown;
  passengers: Array<{
    index: number;
    date_of_birth: string;
    type: PassengerType;
    multiplier: number;
    price: number;
  }>;
  base_price: number;
  currency: string;
}

export interface BookingRow {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  flight_id: string | null;
  currency: string;
  payment_status: string | null;
}

interface FlightRow {
  id: string;
  final_price: number;
}

interface PassengerRow {
  date_of_birth: string;
}

/* ───────────────────── Safe parsers ───────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id);
  const user_id = value.user_id === null ? null : parseString(value.user_id);
  const profile_id = value.profile_id === null ? null : parseString(value.profile_id);
  const flight_id = value.flight_id === null ? null : parseString(value.flight_id);
  const currency = parseString(value.currency) ?? "USD";
  const payment_status = value.payment_status === null ? null : parseString(value.payment_status);

  if (!id) return null;
  return { id, user_id, profile_id, flight_id, currency, payment_status };
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

/* ───────────────────── Service Errors ───────────────────── */

export class PricingServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "BOOKING_NOT_FOUND"
      | "FLIGHT_NOT_FOUND"
      | "NO_PASSENGERS"
      | "ALREADY_PAID"
      | "NO_FLIGHT"
      | "UNSUPPORTED_CURRENCY"
      | "INVALID_DATA"
      | "DB_ERROR",
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "PricingServiceError";
  }
}

/* ───────────────────── Gateway Fee Loader ───────────────────── */

/**
 * Fetches gateway fee policy from app_settings.
 * Falls back to standard processor rates if DB values are missing.
 */
export async function fetchGatewayFeePolicy(
  gateway: PaymentGateway,
): Promise<FeePolicy> {
  const supabaseAdmin = createAdminClient();

  const pctKey = `${gateway}_fee_percentage`;
  const fixedKey = `${gateway}_fee_fixed`;

  const { data: rows } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", [pctKey, fixedKey]);

  let percentage: number | null = null;
  let fixedAmount: number | null = null;

  for (const row of rows ?? []) {
    const val = parseNumber(row.value);
    if (row.key === pctKey) percentage = val;
    if (row.key === fixedKey) fixedAmount = val;
  }

  // Fallback defaults (real processor rates)
  const defaultPct = gateway === "stripe" ? 2.9 : 3.49;
  const defaultFixed = gateway === "stripe" ? 0.30 : 0.49;

  const pct = percentage ?? defaultPct;
  const fixed = fixedAmount ?? defaultFixed;

  if (pct === 0 && fixed === 0) {
    return { type: "none" };
  }
  return { type: "mixed", percentage: pct, fixed_amount: fixed };
}

/* ───────────────────── Main Function ───────────────────── */

/**
 * Calculate the final booking price for a given gateway.
 * This is the single source of truth for pricing calculations.
 *
 * Steps:
 *  1. Fetches booking, flight, and passengers from DB (via admin client)
 *  2. Applies age-based multipliers (Infant 10%, Child 75%, Adult 100%)
 *  3. Adds volatility buffer (3%)
 *  4. Adds gateway fee (Stripe: 2.9%+$0.30 | PayPal: 3.49%+$0.49)
 *  5. Returns full desglose (breakdown)
 *
 * @param bookingId - UUID of the booking
 * @param gateway - 'stripe' | 'paypal'
 * @returns BookingPricingResult with full breakdown
 */
export async function calculateFinalBookingPrice(
  bookingId: string,
  gateway: PaymentGateway
): Promise<BookingPricingResult> {
  const supabaseAdmin = createAdminClient();

  // ── 1. Fetch booking ──
  const { data: bookingData, error: bookingErr } = await supabaseAdmin
    .from("bookings")
    .select("id, user_id, profile_id, flight_id, currency, payment_status")
    .eq("id", bookingId)
    .single();

  if (bookingErr || !bookingData) {
    throw new PricingServiceError("Booking not found", "BOOKING_NOT_FOUND", 404);
  }

  const booking = parseBookingRow(bookingData);
  if (!booking) {
    throw new PricingServiceError("Invalid booking data", "INVALID_DATA", 500);
  }

  if (booking.payment_status === "paid") {
    throw new PricingServiceError("Booking already paid", "ALREADY_PAID", 409);
  }

  if (!booking.flight_id) {
    throw new PricingServiceError("Booking has no flight selected", "NO_FLIGHT", 400);
  }

  if (booking.currency !== "USD") {
    throw new PricingServiceError(
      `Unsupported currency: ${booking.currency}. Only USD supported.`,
      "UNSUPPORTED_CURRENCY",
      400
    );
  }

  // ── 2. Fetch flight (base price) ──
  const { data: flightData, error: flightErr } = await supabaseAdmin
    .from("flights")
    .select("id, final_price")
    .eq("id", booking.flight_id)
    .single();

  if (flightErr || !flightData) {
    throw new PricingServiceError("Flight not found", "FLIGHT_NOT_FOUND", 404);
  }

  const flight = parseFlightRow(flightData);
  if (!flight) {
    throw new PricingServiceError("Invalid flight data", "INVALID_DATA", 500);
  }

  // ── 3. Fetch passengers ──
  const { data: paxData, error: paxErr } = await supabaseAdmin
    .from("booking_passengers")
    .select("date_of_birth")
    .eq("booking_id", booking.id);

  if (paxErr || !paxData) {
    throw new PricingServiceError("Failed to fetch passengers", "DB_ERROR", 500);
  }

  const passengers = parsePassengerRows(paxData);
  if (!passengers || passengers.length === 0) {
    throw new PricingServiceError("No passengers found for booking", "NO_PASSENGERS", 400);
  }

  // ── 4. Fetch gateway fee from DB ──
  const gatewayFeePolicy = await fetchGatewayFeePolicy(gateway);

  // ── 5. Calculate via pure engine ──
  const breakdown = calculateBookingTotal(flight.final_price, passengers, gateway, gatewayFeePolicy);

  // ── 6. Get per-passenger detail ──
  const passengerDetails = getPassengerPricingDetails(flight.final_price, passengers);

  return {
    booking_id: booking.id,
    gateway,
    breakdown,
    passengers: passengerDetails,
    base_price: flight.final_price,
    currency: booking.currency,
  };
}

/**
 * Persist pricing breakdown to the bookings table.
 * Called after payment intent/order creation.
 */
export async function persistPricingToBooking(
  bookingId: string,
  gateway: PaymentGateway,
  breakdown: PriceBreakdown,
  paymentReferenceId: string
): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      payment_method: gateway,
      payment_gateway: gateway,
      payment_intent_id: paymentReferenceId,
      subtotal: breakdown.subtotal,
      payment_gateway_fee: breakdown.gateway_fee_amount,
      total_amount: breakdown.total_amount,
      pricing_breakdown: breakdown,
    })
    .eq("id", bookingId);

  if (error) {
    throw new PricingServiceError(
      `Failed to update booking: ${error.message}`,
      "DB_ERROR",
      500
    );
  }
}

/**
 * Fetch booking row for ownership validation in API routes.
 */
export async function fetchBookingForAuth(
  bookingId: string
): Promise<BookingRow> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, user_id, profile_id, flight_id, currency, payment_status")
    .eq("id", bookingId)
    .single();

  if (error || !data) {
    throw new PricingServiceError("Booking not found", "BOOKING_NOT_FOUND", 404);
  }

  const booking = parseBookingRow(data);
  if (!booking) {
    throw new PricingServiceError("Invalid booking data", "INVALID_DATA", 500);
  }

  return booking;
}