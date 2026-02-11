export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

const BodySchema = z.object({
  booking_id: z.string().min(1),
});

type BookingRow = {
  id: string;
  subtotal: number;
  payment_gateway_fee: number;
  total_amount: number;
  payment_intent_id: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;

  const id = toString(value.id);
  const subtotal = toNumber(value.subtotal);
  const payment_gateway_fee = toNumber(value.payment_gateway_fee);
  const total_amount = toNumber(value.total_amount);

  const payment_intent_id =
    value.payment_intent_id === null ? null : toString(value.payment_intent_id);

  if (!id || subtotal === null || payment_gateway_fee === null || total_amount === null) {
    return null;
  }

  return { id, subtotal, payment_gateway_fee, total_amount, payment_intent_id };
}

function dollarsToCents(amount: number): number {
  // Evita problemas de float
  return Math.round(amount * 100);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await req.json();
    const { booking_id } = BodySchema.parse(rawBody);

    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, subtotal, payment_gateway_fee, total_amount, payment_intent_id')
      .eq('id', booking_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = parseBookingRow(data);
    if (!booking) {
      return NextResponse.json({ error: 'Invalid booking data' }, { status: 500 });
    }

    // Por ahora: usamos el total guardado en booking (en USD) para crear el intent.
    // En el Paso 2 lo convertimos a pricing 100% calculado en backend.
    const amountCents = dollarsToCents(booking.total_amount);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { booking_id },
    });

    if (!intent.client_secret) {
      return NextResponse.json({ error: 'Missing client_secret' }, { status: 500 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_intent_id: intent.id,
        payment_method: 'stripe',
      })
      .eq('id', booking_id);

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    // Breakdown básico (sale de booking por ahora; lo refinamos en Paso 2)
    return NextResponse.json({
      client_secret: intent.client_secret,
      breakdown: {
        subtotal: booking.subtotal,
        gateway_fee: booking.payment_gateway_fee,
        total_amount: booking.total_amount,
        currency: 'USD',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
