export const runtime = "nodejs";

/**
 * POST /api/bookings/preview
 *
 * Returns price breakdown for a booking + gateway selection.
 * Frontend NEVER calculates prices — this is the single source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calculateFinalBookingPrice,
  fetchBookingForAuth,
  PricingServiceError,
} from "@/services/pricing.service";

const Body = z.object({
  booking_id: z.string().uuid(),
  gateway: z.enum(["stripe", "paypal"]),
});

type JsonRecord = Record<string, unknown>;

function jsonError(status: number, error: string, extra: JsonRecord = {}) {
  return NextResponse.json({ error, status, ...extra }, { status });
}

function jsonOk(data: JsonRecord, status = 200) {
  return NextResponse.json({ ...data, status }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const parsed = Body.safeParse(raw);

    if (!parsed.success) {
      return jsonError(400, "Invalid body", { details: parsed.error.errors });
    }

    const { booking_id, gateway } = parsed.data;

    /* Auth */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return jsonError(401, "Unauthorized");

    /* Ownership */
    const booking = await fetchBookingForAuth(booking_id);
    if (booking.user_id !== user.id && booking.profile_id !== user.id) {
      return jsonError(403, "Forbidden");
    }

    /* Pricing */
    const pricing = await calculateFinalBookingPrice(booking_id, gateway);

    return jsonOk({
      gateway: pricing.gateway,
      breakdown: pricing.breakdown,
      passengers: pricing.passengers,
      base_price: pricing.base_price,
    });
  } catch (err: unknown) {
    if (err instanceof PricingServiceError) {
      return jsonError(err.statusCode, err.message, { code: err.code });
    }
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[Booking Preview]", msg);
    return jsonError(500, msg);
  }
}
