export const runtime = "nodejs";

/**
 * POST /api/payments/create-intent
 *
 * Creates a Stripe PaymentIntent for a booking.
 * Uses pricing.service as single source of truth (no duplicated DB/pricing logic).
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calculateFinalBookingPrice,
  persistPricingToBooking,
  fetchBookingForAuth,
  PricingServiceError,
} from "@/services/pricing.service";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-06-20",
});

const BodySchema = z.object({
  booking_id: z.string().min(1),
});

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { booking_id } = parsed.data;

    // ── 1. Authenticate ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 2. Validate ownership ──
    const booking = await fetchBookingForAuth(booking_id);
    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3. Calculate price (single source of truth) ──
    const pricing = await calculateFinalBookingPrice(booking_id, "stripe");

    // ── 4. Create Stripe PaymentIntent ──
    const amountCents = dollarsToCents(pricing.breakdown.total_amount);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      metadata: { booking_id },
    });

    if (!intent.client_secret) {
      return NextResponse.json({ error: "Missing client_secret" }, { status: 500 });
    }

    // ── 5. Persist to DB ──
    await persistPricingToBooking(booking_id, "stripe", pricing.breakdown, intent.id);

    return NextResponse.json(
      { client_secret: intent.client_secret, breakdown: pricing.breakdown },
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
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}