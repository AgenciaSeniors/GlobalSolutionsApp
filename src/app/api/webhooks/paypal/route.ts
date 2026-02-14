export const runtime = "nodejs";

/**
 * POST /api/webhooks/paypal
 *
 * Handles PayPal webhook events with:
 *  - Signature verification via PayPal Notifications API
 *  - Idempotency via log_paypal_event_once RPC
 *  - PAYMENT.CAPTURE.COMPLETED → marks booking as paid
 *  - PAYMENT.CAPTURE.DENIED/REVERSED/REFUNDED → marks as failed
 *
 * CRITICAL: This endpoint must NOT require auth (called by PayPal servers).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* ───────────────────── Utility types ───────────────────── */

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

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

/* ───────────────────── PayPal Auth ───────────────────── */

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

  if (!token) throw new Error("PayPal access token missing");
  return token;
}

/* ───────────────────── Signature Verification ───────────────────── */

async function verifyPayPalWebhookSignature(
  headers: Headers,
  event: unknown
): Promise<boolean> {
  const auth_algo = headers.get("paypal-auth-algo");
  const cert_url = headers.get("paypal-cert-url");
  const transmission_id = headers.get("paypal-transmission-id");
  const transmission_sig = headers.get("paypal-transmission-sig");
  const transmission_time = headers.get("paypal-transmission-time");

  if (!auth_algo || !cert_url || !transmission_id || !transmission_sig || !transmission_time) {
    console.error("[PayPal Webhook] Missing signature headers");
    return false;
  }

  const token = await getPayPalAccessToken();

  const verifyBody = {
    auth_algo,
    cert_url,
    transmission_id,
    transmission_sig,
    transmission_time,
    webhook_id: requiredEnv("PAYPAL_WEBHOOK_ID"),
    webhook_event: event,
  };

  const res = await fetch(
    `${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verifyBody),
    }
  );

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("[PayPal Webhook] Verify request failed:", raw);
    return false;
  }

  const status =
    isRecord(raw) && typeof raw.verification_status === "string"
      ? raw.verification_status
      : null;

  return status === "SUCCESS";
}

/* ───────────────────── Event extractors ───────────────────── */

function extractEventId(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const id = event.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function extractEventType(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const eventType = event.event_type;
  return typeof eventType === "string" && eventType.length > 0 ? eventType : null;
}

function extractBookingId(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const resource = event.resource;
  if (!isRecord(resource)) return null;

  // 1) custom_id (set during order creation)
  const customId = resource.custom_id;
  if (typeof customId === "string" && customId.length > 0) return customId;

  // 2) purchase_units[0].custom_id (capture payload structure)
  const purchaseUnits = resource.purchase_units;
  if (Array.isArray(purchaseUnits) && purchaseUnits.length > 0 && isRecord(purchaseUnits[0])) {
    const puCustomId = purchaseUnits[0].custom_id;
    if (typeof puCustomId === "string" && puCustomId.length > 0) return puCustomId;

    const ref = purchaseUnits[0].reference_id;
    if (typeof ref === "string" && ref.length > 0) return ref;
  }

  return null;
}

function extractOrderId(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const resource = event.resource;
  if (!isRecord(resource)) return null;

  // supplementary_data.related_ids.order_id
  const supplementary = resource.supplementary_data;
  if (isRecord(supplementary)) {
    const related = supplementary.related_ids;
    if (isRecord(related)) {
      const orderId = related.order_id;
      if (typeof orderId === "string" && orderId.length > 0) return orderId;
    }
  }

  // Fallback: resource.id for CHECKOUT.ORDER.APPROVED events
  const resourceId = resource.id;
  if (typeof resourceId === "string" && resourceId.length > 0) return resourceId;

  return null;
}

function extractCaptureAmount(event: unknown): number | null {
  if (!isRecord(event)) return null;
  const resource = event.resource;
  if (!isRecord(resource)) return null;

  const amount = resource.amount;
  if (!isRecord(amount)) return null;

  const value = amount.value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/* ───────────────────── Idempotency ───────────────────── */

async function logPayPalEventWithIdempotency(params: {
  eventId: string;
  eventType: string;
  bookingId: string | null;
  orderId: string | null;
  payload: unknown;
}): Promise<boolean> {
  const supabaseAdmin = createAdminClient();
  const payloadJson = toJson(params.payload);

  const { data, error } = await supabaseAdmin.rpc("log_paypal_event_once", {
    p_event_id: params.eventId,
    p_event_type: params.eventType,
    p_booking_id: params.bookingId,
    p_order_id: params.orderId,
    p_payload: payloadJson,
  });

  if (error) {
    console.error("[PayPal Webhook] RPC log_paypal_event_once failed:", error.message);
    throw new Error(`RPC failed: ${error.message}`);
  }

  return data === true;
}

/* ───────────────────── DB updates ───────────────────── */

async function markBookingPaid(params: {
  bookingId: string;
  orderId: string | null;
  captureAmount: number | null;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    payment_method: "paypal",
    payment_gateway: "paypal",
    paid_at: new Date().toISOString(),
  };

  if (params.orderId) {
    updatePayload.payment_intent_id = params.orderId;
  }

  // If capture amount differs from stored total, log it but don't override
  // (the stored total is our source of truth from create-order)

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updatePayload)
    .eq("id", params.bookingId);

  if (error) {
    console.error("[PayPal Webhook] DB update failed:", error.message);
    throw new Error(`DB update failed: ${error.message}`);
  }
}

async function markBookingFailed(params: {
  bookingId: string;
  orderId: string | null;
  eventType: string;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const updatePayload: Record<string, unknown> = {
    payment_status: "failed",
    payment_method: "paypal",
    payment_gateway: "paypal",
  };

  if (params.orderId) {
    updatePayload.payment_intent_id = params.orderId;
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update(updatePayload)
    .eq("id", params.bookingId);

  if (error) {
    console.error("[PayPal Webhook] DB update failed:", error.message);
    throw new Error(`DB update failed: ${error.message}`);
  }
}

/* ───────────────────── Handler ───────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawText = await req.text();

    let event: unknown;
    try {
      event = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // ── 1. Verify signature (CRITICAL) ──
    const verified = await verifyPayPalWebhookSignature(req.headers, event);
    if (!verified) {
      console.error("[PayPal Webhook] Signature verification FAILED");
      return NextResponse.json(
        { error: "Invalid PayPal webhook signature" },
        { status: 400 }
      );
    }

    // ── 2. Extract event metadata ──
    const eventId = extractEventId(event);
    const eventType = extractEventType(event);
    const bookingId = extractBookingId(event);
    const orderId = extractOrderId(event);

    if (!eventId || !eventType) {
      console.error("[PayPal Webhook] Missing event ID or type");
      return NextResponse.json({ error: "Invalid event structure" }, { status: 400 });
    }

    console.log(
      `[PayPal Webhook] Received: ${eventType} | event=${eventId} | booking=${bookingId} | order=${orderId}`
    );

    // ── 3. Idempotency check ──
    try {
      const inserted = await logPayPalEventWithIdempotency({
        eventId,
        eventType,
        bookingId,
        orderId,
        payload: event,
      });

      if (!inserted) {
        console.log("[PayPal Webhook] Duplicate event ignored:", eventId);
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Event logging failed";
      console.error("[PayPal Webhook] Event logging failed:", message);
      return NextResponse.json({ error: "Event logging failed" }, { status: 500 });
    }

    // ── 4. Process event (first time only) ──
    try {
      switch (eventType) {
        case "PAYMENT.CAPTURE.COMPLETED": {
          if (!bookingId) {
            console.error("[PayPal Webhook] No bookingId for CAPTURE.COMPLETED");
            return NextResponse.json({ received: true }, { status: 200 });
          }

          const captureAmount = extractCaptureAmount(event);
          await markBookingPaid({ bookingId, orderId, captureAmount });
          console.log("[PayPal Webhook] ✅ Booking marked as paid:", bookingId);
          break;
        }

        case "PAYMENT.CAPTURE.DENIED":
        case "PAYMENT.CAPTURE.REVERSED":
        case "PAYMENT.CAPTURE.REFUNDED": {
          if (!bookingId) {
            console.error(`[PayPal Webhook] No bookingId for ${eventType}`);
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await markBookingFailed({ bookingId, orderId, eventType });
          console.log(`[PayPal Webhook] ❌ Booking marked as failed (${eventType}):`, bookingId);
          break;
        }

        default: {
          console.log(`[PayPal Webhook] Unhandled event type: ${eventType}`);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook handler failed";
      console.error("[PayPal Webhook] Handler failed:", message);
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("[PayPal Webhook] Unexpected error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}