export const runtime = "nodejs";

/**
 * POST /api/payments/refund
 *
 * Processes a refund for a booking. Admin/Agent only.
 *
 * Flow:
 * 1. Authenticate + verify admin/agent role
 * 2. Fetch booking from DB
 * 3. Calculate refund via refundCalculator (pure)
 * 4. Execute refund on gateway (Stripe or PayPal)
 * 5. Update booking DB + log event
 * 6. Return refund details
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateRefundAmount } from "@/lib/payments/refundCalculator";
// ❌ RETIRADO: import { notifyRefund } ...

/* ───────────────────── Env ───────────────────── */

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

/* ───────────────────── Helpers ───────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/* ───────────────────── PayPal helpers ───────────────────── */

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
    throw new Error(
      isRecord(raw) && typeof raw.error_description === "string"
        ? raw.error_description
        : "Failed to get PayPal access token"
    );
  }

  const token =
    isRecord(raw) && typeof raw.access_token === "string" ? raw.access_token : null;
  if (!token) throw new Error("PayPal access token missing");
  return token;
}

async function getPayPalCaptureId(orderId: string): Promise<string | null> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok || !isRecord(raw)) return null;

  const purchaseUnits = raw.purchase_units;
  if (!Array.isArray(purchaseUnits) || purchaseUnits.length === 0) return null;

  const pu = purchaseUnits[0];
  if (!isRecord(pu)) return null;

  const payments = pu.payments;
  if (!isRecord(payments)) return null;

  const captures = payments.captures;
  if (!Array.isArray(captures) || captures.length === 0) return null;

  const capture = captures[0];
  if (!isRecord(capture)) return null;

  return typeof capture.id === "string" ? capture.id : null;
}

async function refundPayPalCapture(
  captureId: string,
  amountUsd: number
): Promise<{ success: boolean; refundId: string | null; error?: string }> {
  const token = await getPayPalAccessToken();

  const body = {
    amount: {
      value: amountUsd.toFixed(2),
      currency_code: "USD",
    },
    note_to_payer: "Refund from Global Solutions Travel",
  };

  const res = await fetch(
    `${paypalBaseUrl()}/v2/payments/captures/${captureId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `gs-refund-${captureId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    }
  );

  const raw: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      isRecord(raw) && typeof raw.message === "string"
        ? raw.message
        : "PayPal refund failed";
    return { success: false, refundId: null, error: msg };
  }

  const refundId =
    isRecord(raw) && typeof raw.id === "string" ? raw.id : null;

  return { success: true, refundId };
}

/* ───────────────────── Validation ───────────────────── */

const BodySchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
  reason: z.enum(["customer_request", "flight_cancelled"]),
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
    const { booking_id, reason } = parsed.data;

    // ── 2. Authenticate + verify role ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const role = typeof profile.role === "string" ? profile.role : "";
    if (role !== "admin" && role !== "agent") {
      return NextResponse.json(
        { error: "Only admin or agent can process refunds" },
        { status: 403 }
      );
    }

    // ── 3. Fetch booking ──
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select(`
        id, booking_code, total_amount, payment_gateway_fee, payment_status, 
        payment_method, payment_gateway, payment_intent_id, paid_at, pricing_breakdown
      `)
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.payment_status !== "paid") {
      return NextResponse.json(
        { error: `Cannot refund booking with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    // ── 4. Calculate refund amount ──
    const hoursSinceBooking = booking.paid_at
      ? Math.floor(
          (Date.now() - new Date(booking.paid_at).getTime()) / (1000 * 60 * 60)
        )
      : 0;

    const gatewayFee: number =
      (typeof booking.payment_gateway_fee === "number"
        ? booking.payment_gateway_fee
        : 0) ||
      (isRecord(booking.pricing_breakdown) &&
      typeof booking.pricing_breakdown.gateway_fee_amount === "number"
        ? booking.pricing_breakdown.gateway_fee_amount
        : 0);

    const totalPaid =
      typeof booking.total_amount === "number" ? booking.total_amount : 0;

    const refundCalc = calculateRefundAmount({
      totalPaid,
      hoursSinceBooking,
      isAirlineCancel: reason === "flight_cancelled",
      gatewayFee,
    });

    if (refundCalc.refund_amount <= 0) {
      return NextResponse.json(
        { error: "No refundable amount", details: refundCalc },
        { status: 400 }
      );
    }

    // ── 5. Execute refund on gateway ──
    const gateway = booking.payment_gateway || booking.payment_method || "stripe";
    let gatewayRefundId: string | null = null;

    if (gateway === "stripe") {
      const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
        apiVersion: "2024-06-20",
      });

      if (!booking.payment_intent_id) {
        return NextResponse.json(
          { error: "No payment_intent_id found for Stripe refund" },
          { status: 400 }
        );
      }

      const stripeRefund = await stripe.refunds.create({
        payment_intent: booking.payment_intent_id,
        amount: refundCalc.cents.refund_amount,
        reason: "requested_by_customer",
        metadata: {
          booking_id,
          refund_reason: reason,
          processed_by: user.id,
        },
      });

      gatewayRefundId = stripeRefund.id;

    } else if (gateway === "paypal") {
      if (!booking.payment_intent_id) {
        return NextResponse.json(
          { error: "No PayPal order_id found for refund" },
          { status: 400 }
        );
      }
      const captureId = await getPayPalCaptureId(booking.payment_intent_id);
      if (!captureId) {
        return NextResponse.json(
          { error: "Could not find PayPal capture ID" },
          { status: 400 }
        );
      }
      const ppResult = await refundPayPalCapture(captureId, refundCalc.refund_amount);
      if (!ppResult.success) {
        return NextResponse.json(
          { error: ppResult.error ?? "PayPal refund failed" },
          { status: 502 }
        );
      }
      gatewayRefundId = ppResult.refundId;
    } else {
      return NextResponse.json(
        { error: `Unknown payment gateway: ${gateway}` },
        { status: 400 }
      );
    }

    // ── 6. Update booking in DB ──
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "refunded",
        refund_amount: refundCalc.refund_amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updErr) {
      console.error("[Refund] DB update failed:", updErr.message);
    }

    // ── 7. Log refund event ──
    await supabaseAdmin
      .rpc("log_payment_event_once", {
        p_provider: gateway,
        p_event_id: `refund_${gatewayRefundId ?? booking_id}_${Date.now()}`,
        p_event_type: "refund.processed",
        p_booking_id: booking_id,
        p_payment_intent_id: booking.payment_intent_id,
        p_payload: toJson({
          reason,
          processed_by: user.id,
          gateway_refund_id: gatewayRefundId,
          calculation: refundCalc,
          timestamp: new Date().toISOString(),
        }),
      });

    // ❌ RETIRADO: Envío de email (notifyRefund)

    // ── 8. Return result ──
    return NextResponse.json(
      {
        success: true,
        booking_id,
        gateway,
        gateway_refund_id: gatewayRefundId,
        calculation: refundCalc,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Refund] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}