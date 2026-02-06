/**
 * @fileoverview POST /api/payments/create-intent
 *               Creates a Stripe PaymentIntent for a given booking.
 * @module app/api/payments/create-intent/route
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = (await request.json()) as { booking_id: string };

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify ownership
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, total_amount, booking_code, user_id')
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.total_amount * 100), // cents
      currency: 'usd',
      metadata: {
        booking_id: booking.id,
        booking_code: booking.booking_code,
      },
    });

    // Persist PaymentIntent ID
    await supabase
      .from('bookings')
      .update({ payment_intent_id: paymentIntent.id })
      .eq('id', booking.id);

    return NextResponse.json({ client_secret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
