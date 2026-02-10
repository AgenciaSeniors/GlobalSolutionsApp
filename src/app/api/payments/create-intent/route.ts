/**
 * POST /api/payments/create-intent
 * - Recalcula totales con priceEngine (source of truth)
 * - Actualiza booking (subtotal/fees/total/status)
 * - Crea o reutiliza PaymentIntent en Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { priceEngine } from '@/lib/pricing/priceEngine';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type CreateIntentBody = {
  booking_id: string;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

// Defaults (luego puedes moverlos a app_settings)
const DEFAULT_GATEWAY_FEE_PERCENT = 2.9;
const DEFAULT_GATEWAY_FEE_FIXED = 0.3;
const DEFAULT_VOLATILITY_BUFFER_PERCENT = 0; // pon 3 si quieres 3%

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateIntentBody;

    if (!body.booking_id) {
      return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
    }

    // Session client: solo para identificar al usuario autenticado
    const supabaseSession = await createClient();
    const {
      data: { user },
    } = await supabaseSession.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Admin client: para escribir campos sensibles de pago sin depender de RLS
    const supabaseAdmin = createAdminClient();

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_code, user_id, subtotal, payment_status, payment_intent_id, flight_id')
      .eq('id', body.booking_id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Opcional: traer markup_percentage desde flights
    let markupPercentage = 10;
    if (booking.flight_id) {
      const { data: flight } = await supabaseAdmin
        .from('flights')
        .select('markup_percentage')
        .eq('id', booking.flight_id)
        .single();

      const mp = flight?.markup_percentage;
      if (typeof mp === 'number' && Number.isFinite(mp) && mp >= 0) {
        markupPercentage = mp;
      }
    }

    // Base: usamos booking.subtotal (ya incorpora lógica de tu booking: pax, etc.)
    const baseAmount = Number(booking.subtotal);
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      return NextResponse.json({ error: 'Subtotal inválido en booking' }, { status: 400 });
    }

    const breakdown = priceEngine({
      base: { amount: baseAmount, currency: 'USD' },
      markup: { type: 'percentage', percentage: markupPercentage },
      volatility_buffer:
        DEFAULT_VOLATILITY_BUFFER_PERCENT > 0
          ? { type: 'percentage', percentage: DEFAULT_VOLATILITY_BUFFER_PERCENT }
          : { type: 'none' },
      gateway_fee: {
        type: 'mixed',
        percentage: DEFAULT_GATEWAY_FEE_PERCENT,
        fixed_amount: DEFAULT_GATEWAY_FEE_FIXED,
      },
      gateway_fee_base: 'pre_fee_total',
    });

    const amountCents = breakdown.cents.total_amount;

    // Persistir totales antes de cobrar
    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({
        subtotal: breakdown.subtotal,
        payment_gateway_fee: breakdown.gateway_fee_amount,
        total_amount: breakdown.total_amount,
        payment_status: 'pending',
        payment_method: 'stripe',
      })
      .eq('id', booking.id);

    if (updateErr) {
      return NextResponse.json({ error: 'No se pudo actualizar totales del booking' }, { status: 500 });
    }

    // Reusar intent existente si calza
    if (booking.payment_intent_id && booking.payment_status === 'pending') {
      try {
        const existing = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        if (existing.amount === amountCents && existing.client_secret) {
          return NextResponse.json({
            client_secret: existing.client_secret,
            payment_intent_id: existing.id,
            total_amount: breakdown.total_amount,
            currency: breakdown.currency,
            breakdown,
            reused: true,
          });
        }
      } catch {
        // si falla retrieve, creamos uno nuevo abajo
      }
    }

    // Crear nuevo intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        metadata: {
          booking_id: booking.id,
          booking_code: booking.booking_code,
        },
        automatic_payment_methods: { enabled: true },
      },
      {
        idempotencyKey: `booking_${booking.id}_amount_${amountCents}`,
      },
    );

    const { error: intentSaveErr } = await supabaseAdmin
      .from('bookings')
      .update({ payment_intent_id: paymentIntent.id })
      .eq('id', booking.id);

    if (intentSaveErr) {
      return NextResponse.json({ error: 'No se pudo guardar payment_intent_id' }, { status: 500 });
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      total_amount: breakdown.total_amount,
      currency: breakdown.currency,
      breakdown,
      reused: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
