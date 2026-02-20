export const runtime = "nodejs";

/**
 * POST /api/payments/zelle/confirm
 *
 * Allows an admin or agent to confirm that a Zelle transfer was received.
 * This is the manual step that completes the Zelle payment flow:
 *
 *  1. User selects Zelle at checkout → booking created with payment_status='pending_admin_approval'
 *  2. User transfers money via Zelle (outside the app)
 *  3. Admin/Agent verifies transfer received → calls this endpoint
 *  4. Booking updated to payment_status='paid'
 *
 * Auth: admin or agent role required.
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
    const { booking_id } = parsed.data;

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
        { error: "Only admin or agent can confirm Zelle payments" },
        { status: 403 }
      );
    }

    // ── 4. Fetch booking ──
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_code, payment_status, payment_method, total_amount, user_id"
      )
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

    // Si ya está pagado, responde OK (idempotente)
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        {
          success: true,
          already_confirmed: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    // Ahora el estado válido para confirmar Zelle es pending_admin_approval
    if (booking.payment_status !== "pending_admin_approval") {
      return NextResponse.json(
        { error: `Cannot confirm payment with status: ${booking.payment_status}` },
        { status: 400 }
      );
    }

    // ── 6. Idempotency gate (log event once) ──
    const eventId = `confirm:${booking_id}`;
    const payload = toJson({
      confirmed_by: user.id,
      confirmed_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc(
      "log_payment_event_once",
      {
        p_provider: "zelle",
        p_event_id: eventId,
        p_event_type: "zelle.confirm",
        p_booking_id: booking_id,
        p_payment_intent_id: null,
        p_payload: payload,
      }
    );

    if (logErr) {
      console.error("[Zelle Confirm] Event log failed:", logErr.message);
      return NextResponse.json(
        { error: "Failed to log payment event" },
        { status: 500 }
      );
    }

    // Si ya existía el evento, ya fue confirmado antes.
    // PERO: el insert del evento puede haber ocurrido en un intento previo donde el UPDATE falló.
    // Para robustez total, si el booking aún NO está en 'paid', hacemos un "repair" idempotente.
    if (!inserted) {
      if (booking.payment_status !== "paid") {
        const { error: repairErr } = await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "paid",
            payment_gateway: "zelle",
            paid_at: new Date().toISOString(),
          })
          .eq("id", booking_id)
          .eq("payment_status", "pending_admin_approval")
          .eq("payment_method", "zelle");

        if (repairErr) {
          console.error(
            "[Zelle Confirm] Repair update failed:",
            repairErr.message
          );
          return NextResponse.json(
            { error: "Event exists but booking could not be repaired" },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            already_confirmed: true,
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
          already_confirmed: true,
          booking_id,
          booking_code: booking.booking_code,
        },
        { status: 200 }
      );
    }

    // ── 7. Update booking to paid (atomic) ──
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        payment_gateway: "zelle",
        paid_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .eq("payment_status", "pending_admin_approval")
      .eq("payment_method", "zelle"); // extra safety

    if (updErr) {
      console.error("[Zelle Confirm] DB update failed:", updErr.message);
      // OJO: el evento ya quedó registrado; esto indica carrera/estado cambiado.
      return NextResponse.json(
        { error: "Failed to update booking after logging event" },
        { status: 500 }
      );
    }

    // ── 8. Return success ──
    return NextResponse.json(
      {
        success: true,
        booking_id,
        booking_code: booking.booking_code,
        confirmed_by: user.id,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Zelle Confirm] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}