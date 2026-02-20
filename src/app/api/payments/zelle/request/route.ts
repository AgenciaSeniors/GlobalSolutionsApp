export const runtime = "nodejs";

/**
 * POST /api/payments/zelle/request
 *
 * Called when Zelle is selected (client checkout) OR by staff (admin/agent) when switching a booking to Zelle.
 * Marks a booking as pending admin approval, and logs an idempotent event.
 *
 * Requirements:
 * - Authenticated user
 * - Client: booking must belong to user (profile_id === user.id)
 * - Staff (admin/agent): can request for any booking
 * - Booking must not be paid/refunded
 *
 * Idempotency:
 * - provider='zelle', event_id=`request:${booking_id}`
 * - If event already exists, returns 200 and repairs booking if needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  note: z.string().max(500).optional(),
});

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
    const { booking_id, note } = parsed.data;

    // ── 2. Authenticate user ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 3. Resolve role (admin/agent/client) ──
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

    // ── 4. Fetch booking ──
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_code, profile_id, payment_status, payment_method, payment_gateway, total_amount"
      )
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // ── 5. Ownership check ──
    // Client: only their own booking. Admin/agent: can operate any booking.
    if (!isStaff && booking.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 6. Validate state ──
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        {
          success: true,
          already_paid: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    if (booking.payment_status === "refunded") {
      return NextResponse.json(
        { error: "Cannot request Zelle payment for a refunded booking" },
        { status: 400 }
      );
    }

    // ── 7. Idempotency gate (log event once) ──
    const eventId = `request:${booking_id}`;
    const payload = toJson({
      requested_by: user.id,
      requested_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      note: note ?? null,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc(
      "log_payment_event_once",
      {
        p_provider: "zelle",
        p_event_id: eventId,
        p_event_type: "zelle.request",
        p_booking_id: booking_id,
        p_payment_intent_id: null,
        p_payload: payload,
      }
    );

    if (logErr) {
      console.error("[Zelle Request] Event log failed:", logErr.message);
      return NextResponse.json(
        { error: "Failed to log payment event" },
        { status: 500 }
      );
    }

    // helper: ensures booking is pending_admin_approval and configured for Zelle
    const ensurePending = async () => {
      const { error: updErr } = await supabaseAdmin
        .from("bookings")
        .update({
          payment_method: "zelle",
          payment_gateway: "zelle",
          payment_status: "pending_admin_approval",
          paid_at: null,
        })
        .eq("id", booking_id)
        // allow re-request from these states
        .in("payment_status", ["pending", "pending_admin_approval", "failed"]);

      if (updErr) {
        console.error("[Zelle Request] Booking update failed:", updErr.message);
        throw new Error("Failed to update booking for Zelle request");
      }
    };

    // ── 8. If event already exists, repair booking if needed ──
    if (!inserted) {
      if (
        booking.payment_method !== "zelle" ||
        booking.payment_gateway !== "zelle" ||
        booking.payment_status !== "pending_admin_approval"
      ) {
        await ensurePending();
        return NextResponse.json(
          {
            success: true,
            already_requested: true,
            repaired: true,
            booking_id,
            booking_code: booking.booking_code,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          already_requested: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    // ── 9. First time event inserted → update booking ──
    await ensurePending();

    return NextResponse.json(
      {
        success: true,
        booking_id,
        booking_code: booking.booking_code,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Zelle Request] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}