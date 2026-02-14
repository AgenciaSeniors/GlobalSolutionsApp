export const runtime = "nodejs";

/**
 * POST /api/payments/paypal/create-order
 *
 * Creates a PayPal Order using the REST API v2 (no deprecated SDK).
 *
 * Flow:
 *  1. Authenticate user via Supabase session
 *  2. Validate ownership of booking
 *  3. Calculate price via pricing.service (server-side source of truth)
 *  4. Create PayPal Order via REST API
 *  5. Persist order_id + breakdown in bookings table
 *  6. Return { order_id } to frontend for PayPal Buttons SDK
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calculateFinalBookingPrice,
  persistPricingToBooking,
  fetchBookingForAuth,
  PricingServiceError,
} from "@/services/pricing.service";

/* ───────────────────── Env helpers ───────────────────── */

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function paypalBaseUrl(): string {
  const mode = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/* ───────────────────── PayPal REST helpers ───────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = requiredEnv("PAYPAL_CLIENT_ID");
  const clientSecret = requiredEnv("PAYPAL_CLIENT_SECRET");

  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      isRecord(raw) && typeof raw.error_description === "string"
        ? raw.error_description
        : "Failed to get PayPal access token";
    throw new Error(msg);
  }

  const token =
    isRecord(raw) && typeof raw.access_token === "string" ? raw.access_token : null;
  if (!token) throw new Error("PayPal access token missing in response");
  return token;
}

function formatMoney2(amount: number): string {
  return amount.toFixed(2);
}

/* ───────────────────── Validation ───────────────────── */

const BodySchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
});

/* ───────────────────── Handler ───────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Parse body ──
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { booking_id } = parsed.data;

    // ── 2. Authenticate user ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 3. Validate ownership ──
    const booking = await fetchBookingForAuth(booking_id);
    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 4. Calculate price (server-side source of truth) ──
    const pricing = await calculateFinalBookingPrice(booking_id, "paypal");

    // ── 5. Create PayPal Order via REST v2 ──
    const accessToken = await getPayPalAccessToken();

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: booking_id,
          custom_id: booking_id, // maps back in webhook
          description: `Global Solutions Travel - Booking ${booking_id.slice(0, 8)}`,
          amount: {
            currency_code: "USD",
            value: formatMoney2(pricing.breakdown.total_amount),
            breakdown: {
              item_total: {
                currency_code: "USD",
                value: formatMoney2(pricing.breakdown.subtotal),
              },
              handling: {
                currency_code: "USD",
                value: formatMoney2(
                  pricing.breakdown.volatility_buffer_amount +
                    pricing.breakdown.gateway_fee_amount
                ),
              },
            },
          },
        },
      ],
      application_context: {
        brand_name: "Global Solutions Travel",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    };

    const orderRes = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `gs-order-${booking_id}-${Date.now()}`, // idempotency
      },
      body: JSON.stringify(orderPayload),
    });

    const orderRaw: unknown = await orderRes.json().catch(() => null);

    if (!orderRes.ok) {
      console.error("[PayPal Create-Order] API error:", orderRaw);
      const errorMsg =
        isRecord(orderRaw) && typeof orderRaw.message === "string"
          ? orderRaw.message
          : "Failed to create PayPal order";
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const orderId =
      isRecord(orderRaw) && typeof orderRaw.id === "string" ? orderRaw.id : null;

    if (!orderId) {
      return NextResponse.json(
        { error: "PayPal order ID missing in response" },
        { status: 500 }
      );
    }

    // ── 6. Persist to DB ──
    await persistPricingToBooking(
      booking_id,
      "paypal",
      pricing.breakdown,
      orderId
    );

    // ── 7. Return order_id for frontend PayPal Buttons SDK ──
    return NextResponse.json(
      {
        order_id: orderId,
        breakdown: pricing.breakdown,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof PricingServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[PayPal Create-Order] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}