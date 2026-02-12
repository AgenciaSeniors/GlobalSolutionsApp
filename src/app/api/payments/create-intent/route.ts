export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateBookingTotal } from '@/lib/pricing/bookingPricing';

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function getNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type BookingRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  flight_id: string | null;
  currency: string;
  payment_status: string | null;
};

type FlightRow = {
  id: string;
  final_price: number;
};

type PassengerRow = {
  date_of_birth: string;
};

function parseBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;

  const id = getString(value.id);
  const user_id = value.user_id === null ? null : getString(value.user_id);
  const profile_id = value.profile_id === null ? null : getString(value.profile_id);
  const flight_id = value.flight_id === null ? null : getString(value.flight_id);
  const currency = getString(value.currency) ?? 'USD';
  const payment_status = value.payment_status === null ? null : getString(value.payment_status);

  if (!id) return null;

  return { id, user_id, profile_id, flight_id, currency, payment_status };
}

function parseFlightRow(value: unknown): FlightRow | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const final_price = getNumber(value.final_price);
  if (!id || final_price === null) return null;
  return { id, final_price };
}

function parsePassengerRows(value: unknown): PassengerRow[] | null {
  if (!Array.isArray(value)) return null;
  const out: PassengerRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const dob = getString(item.date_of_birth);
    if (!dob) return null;
    out.push({ date_of_birth: dob });
  }
  return out;
}

function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const { booking_id } = BodySchema.parse(raw);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabaseAdmin = createAdminClient();

    // Booking
    const { data: bookingData, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, profile_id, flight_id, currency, payment_status')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !bookingData) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = parseBookingRow(bookingData);
    if (!booking) return NextResponse.json({ error: 'Invalid booking data' }, { status: 500 });

    // ✅ Acepta ownership por user_id o profile_id (tu schema tiene ambos)
    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'Booking already paid' }, { status: 409 });
    }

    if (!booking.flight_id) {
      return NextResponse.json({ error: 'Booking has no flight_id' }, { status: 400 });
    }

    if (booking.currency !== 'USD') {
      return NextResponse.json(
        { error: `Unsupported currency for now: ${booking.currency}. Expected USD.` },
        { status: 400 }
      );
    }

    // Flight (final_price)
    const { data: flightData, error: flightErr } = await supabaseAdmin
      .from('flights')
      .select('id, final_price')
      .eq('id', booking.flight_id)
      .single();

    if (flightErr || !flightData) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    const flight = parseFlightRow(flightData);
    if (!flight) return NextResponse.json({ error: 'Invalid flight data' }, { status: 500 });

    // Passengers (booking_passengers)
    const { data: paxData, error: paxErr } = await supabaseAdmin
      .from('booking_passengers')
      .select('date_of_birth')
      .eq('booking_id', booking.id);

    if (paxErr || !paxData) {
      return NextResponse.json({ error: 'Passengers not found' }, { status: 404 });
    }

    const passengers = parsePassengerRows(paxData);
    if (!passengers || passengers.length === 0) {
      return NextResponse.json({ error: 'No passengers for booking' }, { status: 400 });
    }

    // Recalcular server-side
    const breakdown = calculateBookingTotal(flight.final_price, passengers, 'stripe');
    const amountCents = dollarsToCents(breakdown.total_amount);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { booking_id: booking.id },
    });

    if (!intent.client_secret) {
      return NextResponse.json({ error: 'Missing client_secret' }, { status: 500 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_intent_id: intent.id,
        payment_method: 'stripe',
        subtotal: breakdown.subtotal,
        payment_gateway_fee: breakdown.gateway_fee_amount,
        total_amount: breakdown.total_amount,
        pricing_breakdown: breakdown,
      })
      .eq('id', booking.id);

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    return NextResponse.json({ client_secret: intent.client_secret, breakdown }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
