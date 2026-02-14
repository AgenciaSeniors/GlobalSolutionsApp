export const runtime = "nodejs";

/**
 * POST /api/payments/paypal/capture-order
 *
 * Captures an approved PayPal Order. This is the step that ACTUALLY charges money.
 *
 * Flow:
 *  1. Authenticate user
 *  2. Validate booking ownership
 *  3. Call PayPal REST v2 POST /v2/checkout/orders/{id}/capture
 *  4. Update booking → paid (or let webhook handle it as fallback)
 *  5. Return capture result to frontend
 *
 * The webhook PAYMENT.CAPTURE.COMPLETED is a safety net;
 * this endpoint provides instant feedback to the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

/* ───────────────────── Validation ───────────────────── */

const BodySchema = z.object({
  order_id: z.string().min(1, "order_id is required"),
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
});

/* ───────────────────── Handler ───────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Parse & validate body ──
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { order_id, booking_id } = parsed.data;

    // ── 2. Authenticate user ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 3. Validate booking ownership ──
    const supabaseAdmin = createAdminClient();
    const { data: bookingData, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, profile_id, payment_status, payment_intent_id")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !bookingData) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isOwner =
      bookingData.user_id === user.id || bookingData.profile_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (bookingData.payment_status === "paid") {
      return NextResponse.json({ error: "Booking already paid" }, { status: 409 });
    }

    // Verify the order_id matches what we stored
    if (bookingData.payment_intent_id && bookingData.payment_intent_id !== order_id) {
      return NextResponse.json(
        { error: "Order ID mismatch with booking" },
        { status: 400 }
      );
    }

    // ── 4. Capture the PayPal order ──
    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(
      `${paypalBaseUrl()}/v2/checkout/orders/${order_id}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `gs-capture-${booking_id}-${Date.now()}`,
        },
      }
    );

    const captureRaw: unknown = await captureRes.json().catch(() => null);

    if (!captureRes.ok) {
      console.error("[PayPal Capture] API error:", captureRaw);

      // Handle already-captured (idempotent)
      if (captureRes.status === 422) {
        // Order already captured — check if the booking was already marked
        // This can happen if the webhook arrived first
        const { data: freshBooking } = await supabaseAdmin
          .from("bookings")
          .select("payment_status")
          .eq("id", booking_id)
          .single();

        if (freshBooking?.payment_status === "paid") {
          return NextResponse.json(
            { status: "COMPLETED", already_captured: true },
            { status: 200 }
          );
        }
      }

      const errorDetail =
        isRecord(captureRaw) && typeof captureRaw.message === "string"
          ? captureRaw.message
          : "Failed to capture PayPal order";
      return NextResponse.json({ error: errorDetail }, { status: 502 });
    }

    // ── 5. Parse capture response ──
    const captureStatus =
      isRecord(captureRaw) && typeof captureRaw.status === "string"
        ? captureRaw.status
        : null;

    if (captureStatus !== "COMPLETED") {
      console.error("[PayPal Capture] Unexpected status:", captureStatus);
      return NextResponse.json(
        { error: `Capture status: ${captureStatus ?? "unknown"}` },
        { status: 502 }
      );
    }

    // ── 6. Update booking immediately (webhook is fallback) ──
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_method: "paypal",
        payment_gateway: "paypal",
        paid_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updErr) {
      // Non-fatal: webhook will catch it
      console.error("[PayPal Capture] DB update failed (webhook will retry):", updErr.message);
    }

    // ── 7. Log capture event ──
    const captureId =
      isRecord(captureRaw) && typeof captureRaw.id === "string"
        ? captureRaw.id
        : order_id;

    await supabaseAdmin
      .rpc("log_payment_event_once", {
        p_provider: "paypal",
        p_event_id: `capture_${captureId}_${Date.now()}`,
        p_event_type: "capture.completed.direct",
        p_booking_id: booking_id,
        p_payment_intent_id: order_id,
        p_payload: captureRaw,
      })
      .then(({ error }) => {
        if (error) console.error("[PayPal Capture] Event log failed:", error.message);
      });

    return NextResponse.json(
      { status: "COMPLETED", order_id, booking_id },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[PayPal Capture] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}