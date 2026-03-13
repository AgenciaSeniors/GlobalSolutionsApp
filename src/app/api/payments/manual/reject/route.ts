export const runtime = "nodejs";

/**
 * POST /api/payments/manual/reject
 *
 * Admin/agent rejects a pending manual payment (zelle, pix, spei, square).
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

const METHOD_LABELS: Record<string, string> = {
  zelle: "Zelle",
  pix: "PIX",
  spei: "SPEI",
  square: "Square",
};

const BodySchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
  payment_method: z.enum(VALID_METHODS),
  reason: z.string().min(1).max(500).optional(),
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
    const { booking_id, payment_method, reason } = parsed.data;
    const methodLabel = METHOD_LABELS[payment_method] ?? payment_method;

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
        { error: `Only admin or agent can reject ${methodLabel} payments` },
        { status: 403 }
      );
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_code, payment_status, payment_method, total_amount")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.payment_method !== payment_method) {
      return NextResponse.json(
        { error: `This booking uses ${booking.payment_method}, not ${methodLabel}` },
        { status: 400 }
      );
    }

    if (booking.payment_status === "failed") {
      return NextResponse.json(
        { success: true, already_rejected: true, booking_id, booking_code: booking.booking_code },
        { status: 200 }
      );
    }

    if (booking.payment_status === "paid" || booking.payment_status === "refunded") {
      return NextResponse.json(
        { error: `Cannot reject payment with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    if (booking.payment_status !== "pending_admin_approval") {
      return NextResponse.json(
        { error: `Cannot reject payment with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    // Idempotency gate
    const eventId = `reject:${booking_id}`;
    const payload = toJson({
      rejected_by: user.id,
      rejected_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      payment_method,
      reason: reason ?? null,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc(
      "log_payment_event_once",
      {
        p_provider: payment_method,
        p_event_id: eventId,
        p_event_type: `${payment_method}.reject`,
        p_booking_id: booking_id,
        p_payment_intent_id: null,
        p_payload: payload,
      }
    );

    if (logErr) {
      console.error(`[Manual Reject] Event log failed:`, logErr.message);
      return NextResponse.json(
        { error: "Failed to log payment event" },
        { status: 500 }
      );
    }

    if (!inserted) {
      if (booking.payment_status !== "failed") {
        const { error: repairErr } = await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "failed",
            payment_gateway: payment_method,
            payment_method_detail: reason ? `admin_rejected:${reason}` : "admin_rejected",
          })
          .eq("id", booking_id)
          .eq("payment_status", "pending_admin_approval")
          .eq("payment_method", payment_method);

        if (repairErr) {
          return NextResponse.json(
            { error: "Event exists but booking could not be repaired" },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { success: true, already_rejected: true, repaired: true, booking_id, booking_code: booking.booking_code },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: true, already_rejected: true, booking_id, booking_code: booking.booking_code },
        { status: 200 }
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "failed",
        payment_gateway: payment_method,
        payment_method_detail: reason ? `admin_rejected:${reason}` : "admin_rejected",
      })
      .eq("id", booking_id)
      .eq("payment_status", "pending_admin_approval")
      .eq("payment_method", payment_method);

    if (updErr) {
      console.error(`[Manual Reject] DB update failed:`, updErr.message);
      return NextResponse.json(
        { error: "Failed to update booking after logging event" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, booking_id, booking_code: booking.booking_code, rejected_by: user.id },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Manual Reject] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
