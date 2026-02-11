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

async function bestEffortLogEvent(params: { bookingId: string | null; payload: unknown }): Promise<void> {
  try {
    const supabaseAdmin = createAdminClient();
    const payloadJson = toJson(params.payload);

    // Si tu tabla payment_events existe, esto audita.
    // Si no existe todavía, no rompemos el webhook (solo log).
    const { error } = await supabaseAdmin.from('payment_events').insert({
      provider: 'paypal',
      booking_id: params.bookingId,
      payload: payloadJson,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[PayPal Webhook] payment_events insert failed:', error.message);
    }
  } catch (e) {
    console.error('[PayPal Webhook] payment_events insert error:', e);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawText = await req.text();
    const event: unknown = JSON.parse(rawText);

    const verified = await verifyPayPalWebhookSignature(req.headers, event);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid PayPal webhook signature' }, { status: 400 });
    }

    // Log auditoría best-effort (no frenar webhook)
    const bookingId = extractBookingId(event);
    await bestEffortLogEvent({ bookingId, payload: event });

    if (!isRecord(event) || typeof event.event_type !== 'string') {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Solo procesamos capture completed
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!bookingId) {
      console.error('[PayPal Webhook] Missing bookingId (custom_id/reference_id).');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const orderId = extractOrderId(event);

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'paypal',
        ...(orderId ? { payment_intent_id: orderId } : {}),
      })
      .eq('id', bookingId);

    if (error) {
      console.error('[PayPal Webhook] booking update failed:', error.message);
      // PayPal reintenta si devolvemos 500; es mejor marcar fallo y permitir retry.
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('[PayPal Webhook] error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
