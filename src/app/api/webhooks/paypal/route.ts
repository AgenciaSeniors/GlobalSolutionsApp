export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function paypalBaseUrl(): string {
  const mode = (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = requiredEnv('PAYPAL_CLIENT_ID');
  const clientSecret = requiredEnv('PAYPAL_CLIENT_SECRET');

  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      isRecord(raw) && typeof raw.error_description === 'string'
        ? raw.error_description
        : 'Failed to get PayPal access token';
    throw new Error(msg);
  }

  const token =
    isRecord(raw) && typeof raw.access_token === 'string' ? raw.access_token : null;

  if (!token) throw new Error('PayPal access token missing');
  return token;
}

type VerifyBody = {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: unknown;
};

async function verifyPayPalWebhookSignature(headers: Headers, event: unknown): Promise<boolean> {
  const auth_algo = headers.get('paypal-auth-algo');
  const cert_url = headers.get('paypal-cert-url');
  const transmission_id = headers.get('paypal-transmission-id');
  const transmission_sig = headers.get('paypal-transmission-sig');
  const transmission_time = headers.get('paypal-transmission-time');

  if (!auth_algo || !cert_url || !transmission_id || !transmission_sig || !transmission_time) {
    return false;
  }

  const token = await getPayPalAccessToken();
  const body: VerifyBody = {
    auth_algo,
    cert_url,
    transmission_id,
    transmission_sig,
    transmission_time,
    webhook_id: requiredEnv('PAYPAL_WEBHOOK_ID'),
    webhook_event: event,
  };

  const res = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('[PayPal Webhook] verify failed:', raw);
    return false;
  }

  const status =
    isRecord(raw) && typeof raw.verification_status === 'string'
      ? raw.verification_status
      : null;

  return status === 'SUCCESS';
}

function extractBookingId(event: unknown): string | null {
  // Intentamos extraer booking_id de varios lugares comunes.
  // (Recomendado: setear custom_id = booking.id al crear la orden).
  if (!isRecord(event)) return null;

  const resource = event.resource;
  if (!isRecord(resource)) return null;

  // 1) custom_id (si lo seteamos)
  const customId = resource.custom_id;
  if (typeof customId === 'string' && customId.length > 0) return customId;

  // 2) purchase_units[0].reference_id (a veces viene en webhook payload)
  const purchaseUnits = resource.purchase_units;
  if (Array.isArray(purchaseUnits) && purchaseUnits.length > 0 && isRecord(purchaseUnits[0])) {
    const ref = purchaseUnits[0].reference_id;
    if (typeof ref === 'string' && ref.length > 0) return ref;
  }

  // 3) fallback: nothing
  return null;
}

function extractOrderId(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const resource = event.resource;
  if (!isRecord(resource)) return null;

  // capture completed payload often includes supplementary_data.related_ids.order_id
  const supplementary = resource.supplementary_data;
  if (isRecord(supplementary)) {
    const related = supplementary.related_ids;
    if (isRecord(related)) {
      const orderId = related.order_id;
      if (typeof orderId === 'string' && orderId.length > 0) return orderId;
    }
  }
  return null;
}

function extractEventId(event: unknown): string | null {
  // PayPal event ID for idempotency
  if (!isRecord(event)) return null;
  const id = event.id;
  if (typeof id === 'string' && id.length > 0) return id;
  return null;
}

function extractEventType(event: unknown): string | null {
  if (!isRecord(event)) return null;
  const eventType = event.event_type;
  if (typeof eventType === 'string' && eventType.length > 0) return eventType;
  return null;
}

/**
 * Log PayPal event with idempotency check using RPC
 * Returns: TRUE if inserted (new event), FALSE if duplicate
 */
async function logPayPalEventWithIdempotency(params: {
  eventId: string;
  eventType: string;
  bookingId: string | null;
  orderId: string | null;
  payload: unknown;
}): Promise<boolean> {
  const supabaseAdmin = createAdminClient();
  const payloadJson = toJson(params.payload);

  const { data, error } = await supabaseAdmin.rpc('log_paypal_event_once', {
    p_event_id: params.eventId,
    p_event_type: params.eventType,
    p_booking_id: params.bookingId,
    p_order_id: params.orderId,
    p_payload: payloadJson,
  });

  if (error) {
    console.error('[PayPal Webhook] RPC log_paypal_event_once failed:', error.message);
    throw new Error(`RPC failed: ${error.message}`);
  }

  return data === true;
}

/**
 * Update booking payment status
 */
async function updateBookingPaymentStatus(params: {
  status: 'paid' | 'failed';
  bookingId: string;
  orderId: string | null;
  paidAtIso?: string;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const updatePayload: Record<string, string | null> = {
    payment_status: params.status,
    payment_method: 'paypal',
  };

  if (params.orderId) {
    updatePayload.payment_intent_id = params.orderId;
  }

  if (params.status === 'paid') {
    updatePayload.paid_at = params.paidAtIso ?? new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update(updatePayload)
    .eq('id', params.bookingId);

  if (error) {
    console.error('[PayPal Webhook] DB update failed:', error.message);
    throw new Error(`DB update failed: ${error.message}`);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawText = await req.text();
    const event: unknown = JSON.parse(rawText);

    // 1) Verify PayPal webhook signature
    const verified = await verifyPayPalWebhookSignature(req.headers, event);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid PayPal webhook signature' }, { status: 400 });
    }

    // Extract event data
    const eventId = extractEventId(event);
    const eventType = extractEventType(event);
    const bookingId = extractBookingId(event);
    const orderId = extractOrderId(event);

    if (!eventId || !eventType) {
      console.error('[PayPal Webhook] Missing event ID or type');
      return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 });
    }

    // 2) Idempotency: Log event first
    try {
      const inserted = await logPayPalEventWithIdempotency({
        eventId,
        eventType,
        bookingId,
        orderId,
        payload: event,
      });

      if (!inserted) {
        // Duplicate event: ignore
        console.log('[PayPal Webhook] Duplicate event ignored:', eventId, eventType);
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Event logging failed';
      console.error('[PayPal Webhook] Event logging failed:', message);
      return NextResponse.json({ error: 'Event logging failed' }, { status: 500 });
    }

    // 3) Process event (only first time)
    try {
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          if (!bookingId) {
            console.error('[PayPal Webhook] Missing bookingId for PAYMENT.CAPTURE.COMPLETED');
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await updateBookingPaymentStatus({
            status: 'paid',
            bookingId,
            orderId,
            paidAtIso: new Date().toISOString(),
          });

          console.log('[PayPal Webhook] Booking marked as paid:', bookingId);
          break;
        }

        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.REVERSED':
        case 'PAYMENT.CAPTURE.REFUNDED': {
          if (!bookingId) {
            console.error(`[PayPal Webhook] Missing bookingId for ${eventType}`);
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await updateBookingPaymentStatus({
            status: 'failed',
            bookingId,
            orderId,
          });

          console.log(`[PayPal Webhook] Booking marked as failed (${eventType}):`, bookingId);
          break;
        }

        default: {
          console.log(`[PayPal Webhook] Unhandled event type: ${eventType}`);
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook handler failed';
      console.error('[PayPal Webhook] Handler failed:', message);
      return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('[PayPal Webhook] Unexpected error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
