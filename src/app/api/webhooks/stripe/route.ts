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
  // Usa una versión estable de stripe-node. Si ya fijaste otra, puedes cambiarla,
  // pero esta es segura para PaymentIntents.
  apiVersion: '2024-06-20',
});

/**
 * JSON typing estricta (sin any), para enviar payload a jsonb
 */
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

function toJson(value: unknown): Json {
  // Stripe.Event es serializable; esto elimina prototypes/funciones y asegura Json puro.
  return JSON.parse(JSON.stringify(value)) as Json;
}

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

/**
 * Inserta el evento una sola vez (idempotencia real) usando RPC.
 * Devuelve true si se insertó por primera vez; false si ya existía (duplicado).
 */
async function logStripeEventOnce(params: {
  event: Stripe.Event;
  bookingId: string | null;
  paymentIntentId: string | null;
}): Promise<boolean> {
  const supabaseAdmin = createAdminClient();

  const payload = toJson(params.event);

  const { data, error } = await supabaseAdmin.rpc('log_stripe_event_once', {
    p_event_id: params.event.id,
    p_event_type: params.event.type,
    p_booking_id: params.bookingId,
    p_payment_intent_id: params.paymentIntentId,
    p_payload: payload,
  });

  if (error) {
    // Si esto falla, prefiero NO romper el webhook (Stripe reintenta y puedes duplicar updates).
    // Pero como ya tienes la tabla y la función, esto no debería fallar.
    console.error('[Stripe Webhook] RPC log_stripe_event_once failed:', error.message);
    // Si quieres ser más estricto: return false + 500. En dev es mejor ver el error.
    throw new Error(`RPC failed: ${error.message}`);
  }

  // data debe ser boolean
  return data === true;
}

/**
 * Actualiza booking a paid/failed usando Service Role.
 * - Preferimos actualizar por booking_id si viene en metadata.
 * - Si no viene, fallback por payment_intent_id.
 */
async function updateBookingPaymentStatus(params: {
  status: 'paid' | 'failed';
  bookingId: string | null;
  paymentIntentId: string;
  paidAtIso?: string;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const updatePayload: Record<string, string | null> = {
    payment_status: params.status,
    payment_intent_id: params.paymentIntentId,
    payment_method: 'stripe',
    payment_gateway: 'stripe',
  };

  if (params.status === 'paid') {
    updatePayload.paid_at = params.paidAtIso ?? new Date().toISOString();
  }

  const q = params.bookingId
    ? supabaseAdmin.from('bookings').update(updatePayload).eq('id', params.bookingId)
    : supabaseAdmin.from('bookings').update(updatePayload).eq('payment_intent_id', params.paymentIntentId);

  const { error } = await q;

  if (error) {
    console.error('[Stripe Webhook] DB update failed:', error.message);
    throw new Error(`DB update failed: ${error.message}`);
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

  // Extraer IDs best-effort
  let bookingId: string | null = null;
  let paymentIntentId: string | null = null;

  if (event.type.startsWith('payment_intent.')) {
    const pi = event.data.object as Stripe.PaymentIntent;
    bookingId = getMetadataString(pi.metadata, 'booking_id');
    paymentIntentId = pi.id;
  } else if (isRecord(event.data?.object) && typeof event.data.object.id === 'string') {
    paymentIntentId = event.data.object.id;
  }

  // 1) Idempotencia real: registrar evento primero
  try {
    const inserted = await logStripeEventOnce({
      event,
      bookingId,
      paymentIntentId,
    });

    if (!inserted) {
      // Evento duplicado: no tocar DB otra vez
      console.log('[Stripe Webhook] Duplicate event ignored:', event.id, event.type);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Event logging failed';
    console.error('[Stripe Webhook] Event logging failed:', message);
    // Aquí sí devolvemos 500 para que Stripe reintente, porque sin log no garantizamos idempotencia.
    return NextResponse.json({ error: 'Event logging failed' }, { status: 500 });
  }

  // 2) Procesar evento (solo primera vez)
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;

        const targetBookingId = getMetadataString(pi.metadata, 'booking_id');
        await updateBookingPaymentStatus({
          status: 'paid',
          bookingId: targetBookingId,
          paymentIntentId: pi.id,
          paidAtIso: new Date().toISOString(),
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;

        const targetBookingId = getMetadataString(pi.metadata, 'booking_id');
        await updateBookingPaymentStatus({
          status: 'failed',
          bookingId: targetBookingId,
          paymentIntentId: pi.id,
        });

        break;
      }

      default: {
        // No hacemos nada más (pero ya quedó auditado en payment_events por RPC)
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed';
    console.error('[Stripe Webhook] Handler failed:', message);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}