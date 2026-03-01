export const runtime = "nodejs";

/**
 * POST /api/payments/zelle/confirm
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { paymentProcessingEmail } from "@/lib/email/templates";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

const BodySchema = z.object({
  booking_id: z.string().uuid("booking_id must be a valid UUID"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.errors }, { status: 400 });
    }
    const { booking_id } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const supabaseAdmin = createAdminClient();

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const role = typeof profile.role === "string" ? profile.role : "";
    if (role !== "admin" && role !== "agent") {
      return NextResponse.json({ error: "Only admin or agent can confirm Zelle payments" }, { status: 403 });
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_code, payment_status, payment_method, total_amount, user_id")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    if (booking.payment_method !== "zelle") return NextResponse.json({ error: `This booking uses ${booking.payment_method}, not Zelle` }, { status: 400 });

    if (booking.payment_status === "paid") {
      return NextResponse.json({ success: true, already_confirmed: true, booking_id, booking_code: booking.booking_code }, { status: 200 });
    }

    if (booking.payment_status !== "pending_admin_approval") {
      return NextResponse.json({ error: `Cannot confirm payment with status: ${booking.payment_status}` }, { status: 400 });
    }

    const eventId = `confirm:${booking_id}`;
    const payload = toJson({
      confirmed_by: user.id,
      confirmed_by_role: role,
      booking_code: booking.booking_code,
      amount: booking.total_amount,
      timestamp: new Date().toISOString(),
    });

    const { data: inserted, error: logErr } = await supabaseAdmin.rpc("log_payment_event_once", {
        p_provider: "zelle", p_event_id: eventId, p_event_type: "zelle.confirm", p_booking_id: booking_id, p_payment_intent_id: null, p_payload: payload,
      });

    if (logErr) return NextResponse.json({ error: "Failed to log payment event" }, { status: 500 });

    if (!inserted) {
      if (booking.payment_status !== "paid") {
        const { error: repairErr } = await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "paid",
            booking_status: "pending_emission", // 🚀 FIX: A la cola de emisión
            payment_gateway: "zelle",
            paid_at: new Date().toISOString(),
          })
          .eq("id", booking_id)
          .eq("payment_status", "pending_admin_approval")
          .eq("payment_method", "zelle");

        if (repairErr) return NextResponse.json({ error: "Event exists but booking could not be repaired" }, { status: 500 });

        return NextResponse.json({ success: true, already_confirmed: true, repaired: true, booking_id, booking_code: booking.booking_code }, { status: 200 });
      }
      return NextResponse.json({ success: true, already_confirmed: true, booking_id, booking_code: booking.booking_code }, { status: 200 });
    }

    // ── 7. Update booking to paid (atomic) ──
    const { error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
        booking_status: "pending_emission", // 🚀 FIX: A la cola de emisión
        payment_gateway: "zelle",
        paid_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .eq("payment_status", "pending_admin_approval")
      .eq("payment_method", "zelle"); 

    if (updErr) return NextResponse.json({ error: "Failed to update booking after logging event" }, { status: 500 });

    // 🔔 8. NOTIFICACIÓN POR CORREO AL CLIENTE (MANEJO DE EXPECTATIVAS)
    try {
      const { data: bookingData } = await supabaseAdmin
        .from('bookings')
        .select(`booking_code, profile:profiles!bookings_user_id_fkey(email, full_name)`)
        .eq('id', booking_id)
        .single();

      const profileInfo = bookingData?.profile ? (Array.isArray(bookingData.profile) ? bookingData.profile[0] : bookingData.profile) : null;

      if (bookingData && profileInfo?.email && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'Global Solutions Travel <onboarding@resend.dev>', // Asegurate de cambiar esto cuando estés en Producción
          to: profileInfo.email,
          subject: `Pago Confirmado - Reserva ${bookingData.booking_code}`,
          html: paymentProcessingEmail({
            clientName: profileInfo.full_name || 'Cliente',
            bookingCode: bookingData.booking_code
          })
        });
        console.log(`✅ Correo de expectativa enviado al cliente tras aprobación Zelle: ${profileInfo.email}`);
      }
    } catch (mailError) {
      console.error("⚠️ Error enviando correo al cliente:", mailError);
    }

    // Notificación en App (por si lo aprobó un Agente y el Admin debe emitir)
    try {
      const { data: admins } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: any) => ({
          user_id: admin.id, type: 'system_alert', title: '🚨 NUEVA EMISIÓN PENDIENTE',
          content: `Pago manual de la reserva ${booking.booking_code} aprobado. Ya puedes emitir.`,
          link: `/admin/dashboard/emission?id=${booking_id}`, is_read: false
        }));
        await supabaseAdmin.from('notifications').insert(notifications);
      }
    } catch (e) {
      console.error('[Zelle Confirm] Notification insert failed:', e);
    }

    // ── 9. Return success ──
    return NextResponse.json({ success: true, booking_id, booking_code: booking.booking_code, confirmed_by: user.id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}