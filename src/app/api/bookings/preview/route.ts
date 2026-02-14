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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const parsed = Body.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid body", details: parsed.error.errors }, { status: 400 });

    const { booking_id, gateway } = parsed.data;

    /* Auth */
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    /* Ownership */
    const booking = await fetchBookingForAuth(booking_id);
    if (booking.user_id !== user.id && booking.profile_id !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    /* Pricing */
    const pricing = await calculateFinalBookingPrice(booking_id, gateway);

    return NextResponse.json({
      gateway: pricing.gateway,
      breakdown: pricing.breakdown,
      passengers: pricing.passengers,
      base_price: pricing.base_price,
    });
  } catch (err: unknown) {
    if (err instanceof PricingServiceError)
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[Booking Preview]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}