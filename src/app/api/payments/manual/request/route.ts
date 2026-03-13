export const runtime = "nodejs";

/**
 * POST /api/payments/manual/request
 *
 * Generic manual payment request for all supported methods (zelle, pix, spei, square).
 * Marks a booking as pending admin approval and logs an idempotent event.
 *
 * Requirements:
 * - Authenticated user
 * - Client: booking must belong to user (profile_id === user.id)
 * - Staff (admin/agent): can request for any booking
 * - Booking must not be paid/refunded
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_METHODS = ["zelle", "pix", "spei", "square"] as const;

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

const BodySchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
  payment_method: z.enum(VALID_METHODS),
  note: z.string().max(500).optional(),
});

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
    const { booking_id, payment_method, note } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: requesterProfile, error: requesterErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (requesterErr || !requesterProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const role =
      typeof requesterProfile.role === "string" ? requesterProfile.role : "";
    const isStaff = role === "admin" || role === "agent";

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_code, user_id, profile_id, payment_status, payment_method, payment_gateway, total_amount"
      )
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { success: true, already_paid: true, booking_id, booking_code: booking.booking_code },
        { status: 200 }
      );
    }

    if (booking.payment_status === "refunded") {
      return NextResponse.json(
        { error: "Cannot request payment for a refunded booking" },
        { status: 400 }
      );
    }

    // Idempotency gate
    const eventId = `request:${booking_id}`;
    const payload = toJson({
      requested_by: user.id,
      requested_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      payment_method,
      note: note ?? null,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc(
      "log_payment_event_once",
      {
        p_provider: payment_method,
        p_event_id: eventId,
        p_event_type: `${payment_method}.request`,
        p_booking_id: booking_id,
        p_payment_intent_id: null,
        p_payload: payload,
      }
    );

    if (logErr) {
      console.error(`[Manual Request] Event log failed:`, logErr.message);
      return NextResponse.json(
        { error: "Failed to log payment event" },
        { status: 500 }
      );
    }

    const ensurePending = async () => {
      const { error: updErr } = await supabaseAdmin
        .from("bookings")
        .update({
          payment_method,
          payment_gateway: payment_method,
          payment_status: "pending_admin_approval",
          paid_at: null,
        })
        .eq("id", booking_id)
        .in("payment_status", ["pending", "pending_admin_approval", "failed"]);

      if (updErr) {
        console.error(`[Manual Request] Booking update failed:`, updErr.message);
        throw new Error("Failed to update booking for manual payment request");
      }
    };

    if (!inserted) {
      if (
        booking.payment_method !== payment_method ||
        booking.payment_gateway !== payment_method ||
        booking.payment_status !== "pending_admin_approval"
      ) {
        await ensurePending();
        return NextResponse.json(
          { success: true, already_requested: true, repaired: true, booking_id, booking_code: booking.booking_code },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: true, already_requested: true, booking_id, booking_code: booking.booking_code },
        { status: 200 }
      );
    }

    await ensurePending();

    return NextResponse.json(
      { success: true, booking_id, booking_code: booking.booking_code },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Manual Request] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
