export const runtime = 'nodejs';

/**
 * POST /api/payments/stripe/confirm
 *
 * Llamado por el frontend justo después de que stripe.confirmPayment() retorna exitoso.
 * Verifica el PaymentIntent con Stripe y actualiza la reserva a paid + pending_emission.
 *
 * Esto garantiza que el estado se actualice INMEDIATAMENTE tras el pago,
 * sin depender únicamente del webhook (que puede tardar o fallar).
 * El webhook sigue activo como respaldo con idempotencia real.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { paymentProcessingEmail } from '@/lib/email/templates';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

const BodySchema = z.object({
  booking_id: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Validar body ──
    const raw: unknown = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { booking_id } = parsed.data;

    // ── 2. Autenticar usuario ──
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // ── 3. Obtener reserva con payment_intent_id ──
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_code, payment_intent_id, payment_status, user_id, profile_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // ── 4. Verificar propiedad ──
    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── 5. Idempotencia: si ya está pagado, no hacer nada ──
    if (booking.payment_status === 'paid') {
      console.log(`[StripeConfirm] Booking ${booking.booking_code} ya está pagado. Skipping.`);
      return NextResponse.json({ success: true, already_paid: true });
    }

    if (!booking.payment_intent_id) {
      return NextResponse.json(
        { error: 'No payment intent asociado a esta reserva' },
        { status: 400 }
      );
    }

    // ── 6. Verificar con Stripe que el pago realmente está confirmado ──
    const pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

    if (pi.status !== 'succeeded') {
      console.warn(`[StripeConfirm] PI ${pi.id} status: ${pi.status} (not succeeded yet)`);
      return NextResponse.json(
        { error: `El pago aún no está confirmado por Stripe. Estado: ${pi.status}` },
        { status: 400 }
      );
    }

    // ── 7. Actualizar reserva: paid + pending_emission ──
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        booking_status: 'pending_emission',
        payment_method: 'stripe',
        payment_gateway: 'stripe',
        paid_at: new Date().toISOString(),
      })
      .eq('id', booking_id)
      .eq('payment_status', 'pending'); // Solo actualizar si sigue en pending (seguridad extra)

    if (updateError) {
      console.error('[StripeConfirm] DB update failed:', updateError.message);
      return NextResponse.json({ error: 'Error actualizando la reserva' }, { status: 500 });
    }

    console.log(`✅ [StripeConfirm] Reserva ${booking.booking_code} marcada como pagada y pendiente de emisión.`);

    // ── 8. Notificaciones (correo + in-app) ──
    // No bloqueamos la respuesta si falla algo aquí
    (async () => {
      try {
        // 8a. Correo al cliente
        const { data: bookingData } = await supabaseAdmin
          .from('bookings')
          .select('booking_code, profile:profiles!bookings_user_id_fkey(email, full_name)')
          .eq('id', booking_id)
          .single();

        const profile = bookingData?.profile
          ? (Array.isArray(bookingData.profile) ? bookingData.profile[0] : bookingData.profile)
          : null;

        if (bookingData && profile?.email && process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Global Solutions Travel <onboarding@resend.dev>',
            to: profile.email,
            subject: `Pago Confirmado - Reserva ${bookingData.booking_code}`,
            html: paymentProcessingEmail({
              clientName: profile.full_name || 'Cliente',
              bookingCode: bookingData.booking_code,
            }),
          });
          console.log(`✅ [StripeConfirm] Email de confirmación enviado a ${profile.email}`);
        }

        // 8b. Notificaciones in-app a administradores
        const { data: admins } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          const notifications = admins.map((admin: { id: string }) => ({
            user_id: admin.id,
            type: 'system_alert',
            title: '🚨 NUEVA EMISIÓN PENDIENTE',
            content: `La reserva ${booking.booking_code} ha sido pagada. Ya puedes emitir el boleto.`,
            link: `/admin/dashboard/emission?id=${booking.id}`,
            is_read: false,
          }));
          await supabaseAdmin.from('notifications').insert(notifications);
          console.log(`✅ [StripeConfirm] Notificaciones enviadas a ${admins.length} admins.`);
        }
      } catch (notifyErr) {
        console.error('[StripeConfirm] Error en notificaciones (no crítico):', notifyErr);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[StripeConfirm] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
