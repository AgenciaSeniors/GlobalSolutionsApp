/**
 * @fileoverview POST /api/webhooks/stripe
 *               Verifies Stripe webhook signature and updates booking
 *               payment status on successful payment.
 * @module app/api/webhooks/stripe/route
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

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

      // TODO: Trigger confirmation email via Edge Function
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
