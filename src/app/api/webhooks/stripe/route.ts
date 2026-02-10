/**
 * @fileoverview POST /api/webhooks/stripe
 *               Verifies Stripe webhook signature and updates booking payment status.
 * @module app/api/webhooks/stripe/route
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { createAdminClient } from '@/lib/supabase/admin';
import { notifyBookingConfirmation, notifyPaymentReceipt } from '@/lib/email/notifications';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const stripe = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

type BookingProfile = {
  full_name: string;
  email: string;
};

type FlightAirline = { name: string };
type FlightAirport = { iata_code: string; city: string };

type BookingFlight = {
  flight_number: string;
  departure_datetime: string;
  airline: FlightAirline | null;
  origin_airport: FlightAirport | null;
  destination_airport: FlightAirport | null;
};

type BookingPassenger = { id: string };

type BookingWithRelations = {
  booking_code: string;
  subtotal: number | string;
  payment_gateway_fee: number | string | null;
  total_amount: number | string;
  payment_method: string | null;

  profile: BookingProfile | null;
  flight: BookingFlight | null;
  passengers: BookingPassenger[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isBookingProfile(value: unknown): value is BookingProfile {
  if (!isRecord(value)) return false;
  return isString(value.full_name) && isString(value.email);
}
function isFlightAirport(value: unknown): value is FlightAirport {
  if (!isRecord(value)) return false;
  return isString(value.iata_code) && isString(value.city);
}
function isFlightAirline(value: unknown): value is FlightAirline {
  if (!isRecord(value)) return false;
  return isString(value.name);
}
function isBookingFlight(value: unknown): value is BookingFlight {
  if (!isRecord(value)) return false;

  const airlineOk = value.airline === null || value.airline === undefined || isFlightAirline(value.airline);
  const originOk =
    value.origin_airport === null || value.origin_airport === undefined || isFlightAirport(value.origin_airport);
  const destOk =
    value.destination_airport === null ||
    value.destination_airport === undefined ||
    isFlightAirport(value.destination_airport);

  return isString(value.flight_number) && isString(value.departure_datetime) && airlineOk && originOk && destOk;
}
function isBookingPassengerArray(value: unknown): value is BookingPassenger[] {
  if (!Array.isArray(value)) return false;
  return value.every((p) => isRecord(p) && isString(p.id));
}
function isBookingWithRelations(value: unknown): value is BookingWithRelations {
  if (!isRecord(value)) return false;

  const profileOk = value.profile === null || value.profile === undefined || isBookingProfile(value.profile);
  const flightOk = value.flight === null || value.flight === undefined || isBookingFlight(value.flight);
  const passengersOk =
    value.passengers === null || value.passengers === undefined || isBookingPassengerArray(value.passengers);

  const subtotalOk = typeof value.subtotal === 'number' || typeof value.subtotal === 'string';
  const gatewayFeeOk =
    value.payment_gateway_fee === null ||
    typeof value.payment_gateway_fee === 'number' ||
    typeof value.payment_gateway_fee === 'string';
  const totalOk = typeof value.total_amount === 'number' || typeof value.total_amount === 'string';
  const paymentMethodOk = value.payment_method === null || typeof value.payment_method === 'string';

  return (
    isString(value.booking_code) &&
    profileOk &&
    flightOk &&
    passengersOk &&
    subtotalOk &&
    gatewayFeeOk &&
    totalOk &&
    paymentMethodOk
  );
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, requiredEnv('STRIPE_WEBHOOK_SECRET'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[Stripe Webhook] Verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // IMPORTANT: webhooks must use Service Role to bypass RLS.
  const supabase = createAdminClient();

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const { error } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('payment_intent_id', paymentIntent.id);

      if (error) {
        console.error('[Stripe Webhook] DB update failed:', error.message);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // Best-effort emails (do not fail webhook if emails fail)
      try {
        /**
         * Use FK constraint joins so Supabase returns OBJECTS (not arrays).
         * If your constraint names differ, adjust only the `!..._fkey` parts below.
         */
        const { data } = await supabase
          .from('bookings')
          .select(
            `
            booking_code, subtotal, payment_gateway_fee, total_amount, payment_method,
            profile:profiles!bookings_user_id_fkey(full_name, email),
            flight:flights!bookings_flight_id_fkey(
              flight_number, departure_datetime,
              airline:airlines!flights_airline_id_fkey(name),
              origin_airport:airports!flights_origin_airport_id_fkey(iata_code, city),
              destination_airport:airports!flights_destination_airport_id_fkey(iata_code, city)
            ),
            passengers:booking_passengers(id)
          `,
          )
          .eq('payment_intent_id', paymentIntent.id)
          .single();

        if (!isBookingWithRelations(data) || !data.profile?.email) break;

        const booking = data;
        const p = booking.profile;
        const f = booking.flight;
        const passengersCount = booking.passengers?.length ?? 1;

        await Promise.all([
          notifyBookingConfirmation(p.email, {
            clientName: p.full_name,
            bookingCode: booking.booking_code,
            flightNumber: f?.flight_number ?? '',
            airline: f?.airline?.name ?? '',
            origin: f?.origin_airport?.iata_code ?? '',
            originCity: f?.origin_airport?.city ?? '',
            destination: f?.destination_airport?.iata_code ?? '',
            destinationCity: f?.destination_airport?.city ?? '',
            departureDate: f?.departure_datetime ? new Date(f.departure_datetime).toLocaleString('es') : '',
            passengers: passengersCount,
            totalAmount: `$${Number(booking.total_amount).toFixed(2)}`,
            paymentMethod: booking.payment_method ?? 'Stripe',
          }),
          notifyPaymentReceipt(p.email, {
            clientName: p.full_name,
            bookingCode: booking.booking_code,
            subtotal: `$${Number(booking.subtotal).toFixed(2)}`,
            gatewayFee: `$${Number(booking.payment_gateway_fee ?? 0).toFixed(2)}`,
            total: `$${Number(booking.total_amount).toFixed(2)}`,
            paymentMethod: booking.payment_method ?? 'Stripe',
            paidAt: new Date().toLocaleString('es'),
          }),
        ]);
      } catch (emailErr: unknown) {
        console.error('[Stripe Webhook] Email notification failed:', emailErr);
      }

      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('payment_intent_id', paymentIntent.id);

      if (error) {
        console.error('[Stripe Webhook] DB update failed (failed):', error.message);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      break;
    }

    default:
      // Stripe CLI triggers extra events; safe to ignore.
      console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
