export const runtime = "nodejs";

/**
 * POST /api/payments/zelle/reject
 *
 * Allows an admin or agent to reject a pending Zelle payment.
 * This is used when the transfer is not received / invalid proof / expired.
 *
 * Requirements:
 * - Auth: admin or agent role required
 * - Booking must be payment_method='zelle'
 * - Booking must be in payment_status='pending_admin_approval'
 *
 * Idempotency:
 * - Logs event once using: provider='zelle', event_id=`reject:${booking_id}`
 * - If event already exists, endpoint returns 200 and (optionally) repairs booking to 'failed'
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
  reason: z.string().min(1).max(500).optional(),
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
    const { booking_id, reason } = parsed.data;

    // ── 2. Authenticate user ──
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ── 3. Verify admin/agent role ──
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
        { error: "Only admin or agent can reject Zelle payments" },
        { status: 403 }
      );
    }

    // ── 4. Fetch booking ──
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_code, payment_status, payment_method, total_amount")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // ── 5. Validate state ──
    if (booking.payment_method !== "zelle") {
      return NextResponse.json(
        { error: `This booking uses ${booking.payment_method}, not Zelle` },
        { status: 400 }
      );
    }

    // Si ya está failed, responde OK (idempotente)
    if (booking.payment_status === "failed") {
      return NextResponse.json(
        {
          success: true,
          already_rejected: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    // No rechazar si ya está paid/refunded
    if (booking.payment_status === "paid" || booking.payment_status === "refunded") {
      return NextResponse.json(
        { error: `Cannot reject Zelle payment with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    // Estado válido para rechazar
    if (booking.payment_status !== "pending_admin_approval") {
      return NextResponse.json(
        { error: `Cannot reject payment with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    // ── 6. Idempotency gate (log event once) ──
    const eventId = `reject:${booking_id}`;
    const payload = toJson({
      rejected_by: user.id,
      rejected_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      reason: reason ?? null,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc(
      "log_payment_event_once",
      {
        p_provider: "zelle",
        p_event_id: eventId,
        p_event_type: "zelle.reject",
        p_booking_id: booking_id,
        p_payment_intent_id: null,
        p_payload: payload,
      }
    );

    if (logErr) {
      console.error("[Zelle Reject] Event log failed:", logErr.message);
      return NextResponse.json(
        { error: "Failed to log payment event" },
        { status: 500 }
      );
    }

    // Si ya existía el evento, ya fue rechazado antes.
    // Si por algún intento previo el UPDATE falló, reparamos.
    if (!inserted) {
      if (booking.payment_status !== "failed") {
        const { error: repairErr } = await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "failed",
            payment_gateway: "zelle",
            payment_method_detail: reason ? `admin_rejected:${reason}` : "admin_rejected",
          })
          .eq("id", booking_id)
          .eq("payment_status", "pending_admin_approval")
          .eq("payment_method", "zelle");

        if (repairErr) {
          console.error("[Zelle Reject] Repair update failed:", repairErr.message);
          return NextResponse.json(
            { error: "Event exists but booking could not be repaired" },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            already_rejected: true,
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
          already_rejected: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    // ── 7. Update booking to failed (atomic) ──
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "failed",
        payment_gateway: "zelle",
        payment_method_detail: reason ? `admin_rejected:${reason}` : "admin_rejected",
      })
      .eq("id", booking_id)
      .eq("payment_status", "pending_admin_approval")
      .eq("payment_method", "zelle");

    if (updErr) {
      console.error("[Zelle Reject] DB update failed:", updErr.message);
      return NextResponse.json(
        { error: "Failed to update booking after logging event" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        booking_id,
        booking_code: booking.booking_code,
        rejected_by: user.id,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Zelle Reject] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}