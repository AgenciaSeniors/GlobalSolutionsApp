export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as paypal from "@paypal/checkout-server-sdk";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateBookingTotal } from '@/lib/pricing/bookingPricing';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

type BookingRow = {
  id: string;
  user_id: string | null;
  flight_id: string | null;
  currency: string; // en tu tabla es text
  payment_status: string | null;
};

type FlightRow = {
  id: string;
  base_price: number;
};

type PassengerRow = {
  date_of_birth: string; // "YYYY-MM-DD"
};

function parseBookingRow(value: unknown): BookingRow | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id);
  const currency = parseString(value.currency) ?? 'USD';

  const user_id = value.user_id === null ? null : parseString(value.user_id);
  const flight_id = value.flight_id === null ? null : parseString(value.flight_id);
  const payment_status = value.payment_status === null ? null : parseString(value.payment_status);

  if (!id) return null;
  return { id, user_id, flight_id, currency, payment_status };
}

function parseFlightRow(value: unknown): FlightRow | null {
  if (!isRecord(value)) return null;

  const id = parseString(value.id);
  const base_price = parseNumeric(value.base_price);

  if (!id || base_price === null) return null;
  return { id, base_price };
}

function parsePassengerRows(value: unknown): PassengerRow[] | null {
  if (!Array.isArray(value)) return null;

  const out: PassengerRow[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const dob = parseString(item.date_of_birth);
    if (!dob) return null;
    out.push({ date_of_birth: dob });
  }
  return out;
}

function formatMoney2(amount: number): string {
  // PayPal requiere string decimal con 2 dígitos para USD
  // (siempre en server, controlado)
  return amount.toFixed(2);
}

function paypalClient(): paypal.core.PayPalHttpClient {
  const clientId = requiredEnv('PAYPAL_CLIENT_ID');
  const clientSecret = requiredEnv('PAYPAL_CLIENT_SECRET');

  const mode = (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase();
  const env =
    mode === 'live'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  return new paypal.core.PayPalHttpClient(env);
}

const BodySchema = z.object({
  booking_id: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await req.json();
    const { booking_id } = BodySchema.parse(raw);

    // 1) Auth del usuario (profesional)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 2) Buscar booking en servidor
    const { data: bookingData, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, flight_id, currency, payment_status')
      .eq('id', booking_id)
      .single();

    if (bookingErr || !bookingData) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = parseBookingRow(bookingData);
    if (!booking) {
      return NextResponse.json({ error: 'Invalid booking data' }, { status: 500 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (booking.payment_status === 'paid') {
      return NextResponse.json({ error: 'Booking already paid' }, { status: 409 });
    }

    if (!booking.flight_id) {
      return NextResponse.json({ error: 'Booking has no flight selected (flight_id is null)' }, { status: 400 });
    }

    // 3) En este módulo el pricing está en USD (tu motor priceEngine solo soporta USD)
    if (booking.currency !== 'USD') {
      return NextResponse.json(
        { error: `Unsupported currency for now: ${booking.currency}. Expected USD.` },
        { status: 400 }
      );
    }

    // 4) Buscar flight.base_price
    const { data: flightData, error: flightErr } = await supabaseAdmin
      .from('flights')
      .select('id, base_price')
      .eq('id', booking.flight_id)
      .single();

    if (flightErr || !flightData) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    const flight = parseFlightRow(flightData);
    if (!flight) {
      return NextResponse.json({ error: 'Invalid flight data' }, { status: 500 });
    }

    // 5) Buscar passengers por booking_id (DOB para reglas infant/adult)
    const { data: paxData, error: paxErr } = await supabaseAdmin
      .from('passengers')
      .select('date_of_birth')
      .eq('booking_id', booking.id);

    if (paxErr || !paxData) {
      return NextResponse.json({ error: 'Passengers not found' }, { status: 404 });
    }

    const passengers = parsePassengerRows(paxData);
    if (!passengers || passengers.length === 0) {
      return NextResponse.json({ error: 'No passengers for booking' }, { status: 400 });
    }

    // 6) Calcular precio real (server-side, fuente de verdad)
    const breakdown = calculateBookingTotal(
      flight.base_price,
      passengers,
      'paypal'
    );

    // 7) Crear orden PayPal
    const client = paypalClient();
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: booking.id, // nos sirve en webhook
          amount: {
            currency_code: 'USD',
            value: formatMoney2(breakdown.total_amount),
          },
        },
      ],
    });

    type PayPalCreateOrderResult = { id?: string };

    const resp = await client.execute<PayPalCreateOrderResult>(request);
    const orderId = typeof resp.result.id === "string" ? resp.result.id : null;


    if (!orderId) {
      return NextResponse.json({ error: 'PayPal order id missing' }, { status: 500 });
    }

    // 9) Guardar en bookings: payment_intent_id + breakdown + montos
    const { error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_method: 'paypal',
        payment_intent_id: orderId,
        subtotal: breakdown.subtotal,
        payment_gateway_fee: breakdown.gateway_fee_amount,
        total_amount: breakdown.total_amount,
        pricing_breakdown: breakdown,
      })
      .eq('id', booking.id);

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    return NextResponse.json({ order_id: orderId }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
