/**
 * @fileoverview POST /api/webhooks/stripe
 *               Verifies Stripe webhook signature and updates booking
 *               payment status on successful payment.
 * @module app/api/webhooks/stripe/route
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { notifyBookingConfirmation, notifyPaymentReceipt } from '@/lib/email/notifications';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[Stripe Webhook] Verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

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

      // Send booking confirmation + payment receipt emails
      try {
        const { data: booking } = await supabase
          .from('bookings')
          .select(`
            booking_code, subtotal, payment_gateway_fee, total_amount, payment_method,
            profile:profiles!user_id(full_name, email),
            flight:flights!flight_id(
              flight_number, departure_datetime,
              airline:airlines!airline_id(name),
              origin_airport:airports!origin_airport_id(iata_code, city),
              destination_airport:airports!destination_airport_id(iata_code, city)
            ),
            passengers:booking_passengers(id)
          `)
          .eq('payment_intent_id', paymentIntent.id)
          .single();

        if (booking?.profile?.email) {
          const p = booking.profile as { full_name: string; email: string };
          const f = booking.flight as { flight_number: string; departure_datetime: string; airline: { name: string }; origin_airport: { iata_code: string; city: string }; destination_airport: { iata_code: string; city: string } };

          await Promise.all([
            notifyBookingConfirmation(p.email, {
              clientName: p.full_name,
              bookingCode: booking.booking_code,
              flightNumber: f?.flight_number || '',
              airline: f?.airline?.name || '',
              origin: f?.origin_airport?.iata_code || '',
              originCity: f?.origin_airport?.city || '',
              destination: f?.destination_airport?.iata_code || '',
              destinationCity: f?.destination_airport?.city || '',
              departureDate: f?.departure_datetime ? new Date(f.departure_datetime).toLocaleString('es') : '',
              passengers: (booking.passengers as { id: string }[])?.length || 1,
              totalAmount: `$${Number(booking.total_amount).toFixed(2)}`,
              paymentMethod: booking.payment_method || 'Stripe',
            }),
            notifyPaymentReceipt(p.email, {
              clientName: p.full_name,
              bookingCode: booking.booking_code,
              subtotal: `$${Number(booking.subtotal).toFixed(2)}`,
              gatewayFee: `$${Number(booking.payment_gateway_fee).toFixed(2)}`,
              total: `$${Number(booking.total_amount).toFixed(2)}`,
              paymentMethod: booking.payment_method || 'Stripe',
              paidAt: new Date().toLocaleString('es'),
            }),
          ]);
          console.log('[Stripe Webhook] Confirmation emails sent to:', p.email);
        }
      } catch (emailErr) {
        // Don't fail webhook if email fails
        console.error('[Stripe Webhook] Email notification failed:', emailErr);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await supabase
        .from('bookings')
        .update({ payment_status: 'failed' })
        .eq('payment_intent_id', paymentIntent.id);

      break;
    }

    default:
      // Unhandled event type — log and ack
      console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
