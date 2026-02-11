/**
 * POST /api/webhooks/stripe
 * - Verifica firma de Stripe
 * - Actualiza bookings.payment_status (paid/failed)
 * - Registra eventos en public.payment_events
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getMetadataString(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
): string | null {
  if (!metadata) return null;
  const v = metadata[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function logPaymentEvent(params: {
  provider: 'stripe';
  event: Stripe.Event;
  bookingId: string | null;
  paymentIntentId: string | null;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();

  // Guardamos todo el event como jsonb (útil para auditoría)
  const row = {
    provider: params.provider,
    event_id: params.event.id,
    event_type: params.event.type,
    booking_id: params.bookingId,
    payment_intent_id: params.paymentIntentId,
    payload: params.event, // Stripe.Event es JSON-serializable
  };

  // ignoreDuplicates evita que un resend cause error por UNIQUE(event_id)
  const { error } = await supabaseAdmin
    .from('payment_events')
    .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true });

  if (error) {
    // No rompemos el webhook por logging
    console.error('[Stripe Webhook] payment_events insert failed:', error.message);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      requiredEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[Stripe Webhook] Verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Para la mayoría de casos que nos importan ahora, el objeto es PaymentIntent
  // pero aun así mantenemos el código seguro.
  let bookingId: string | null = null;
  let paymentIntentId: string | null = null;

  if (isRecord(event.data?.object) && typeof event.data.object.id === 'string') {
    paymentIntentId = event.data.object.id;
  }

  if (event.type.startsWith('payment_intent.')) {
    const pi = event.data.object as Stripe.PaymentIntent;
    bookingId = getMetadataString(pi.metadata, 'booking_id');
    paymentIntentId = pi.id;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;

        const targetBookingId = getMetadataString(pi.metadata, 'booking_id');

        // Preferimos update por booking_id (más confiable que payment_intent_id)
        const update = targetBookingId
          ? supabaseAdmin
              .from('bookings')
              .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                payment_intent_id: pi.id,
                payment_method: 'stripe',
              })
              .eq('id', targetBookingId)
          : supabaseAdmin
              .from('bookings')
              .update({
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                payment_intent_id: pi.id,
                payment_method: 'stripe',
              })
              .eq('payment_intent_id', pi.id);

        const { error } = await update;

        if (error) {
          console.error('[Stripe Webhook] DB update failed (succeeded):', error.message);
          // Stripe debe reintentar
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        await logPaymentEvent({
          provider: 'stripe',
          event,
          bookingId: targetBookingId,
          paymentIntentId: pi.id,
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;

        const targetBookingId = getMetadataString(pi.metadata, 'booking_id');

        const update = targetBookingId
          ? supabaseAdmin
              .from('bookings')
              .update({
                payment_status: 'failed',
                payment_intent_id: pi.id,
                payment_method: 'stripe',
              })
              .eq('id', targetBookingId)
          : supabaseAdmin
              .from('bookings')
              .update({
                payment_status: 'failed',
                payment_intent_id: pi.id,
                payment_method: 'stripe',
              })
              .eq('payment_intent_id', pi.id);

        const { error } = await update;

        if (error) {
          console.error('[Stripe Webhook] DB update failed (failed):', error.message);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        await logPaymentEvent({
          provider: 'stripe',
          event,
          bookingId: targetBookingId,
          paymentIntentId: pi.id,
        });

        break;
      }

      default: {
        // Log de eventos no manejados (no rompe)
        await logPaymentEvent({
          provider: 'stripe',
          event,
          bookingId,
          paymentIntentId,
        });

        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unhandled webhook error';
    console.error('[Stripe Webhook] Handler failed:', message);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
