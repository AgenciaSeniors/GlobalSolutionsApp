/**
 * @fileoverview Review trigger cron endpoint.
 * Runs daily, finds bookings completed yesterday and marks review_requested.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_code, user_id, return_date, review_requested,
        flight:flights(
          destination_airport:airports!destination_airport_id(city)
        ),
        profile:profiles!user_id(full_name, email)
      `)
      .eq('booking_status', 'completed')
      .eq('return_date', yesterdayStr)
      .eq('review_requested', false);

    if (error) {
      console.error('Review trigger query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];

    for (const booking of bookings || []) {
      const profile = booking.profile as { full_name?: string; email?: string } | null;
      const flight = booking.flight as { destination_airport?: { city?: string } } | null;
      const destination = flight?.destination_airport?.city || 'tu destino';

      await supabaseAdmin.from('bookings').update({ review_requested: true }).eq('id', booking.id);

      // En prod: enviar email real (Resend/Sendgrid). Acá lo “simulamos”
      results.push({
        booking_id: booking.id,
        booking_code: booking.booking_code,
        user_email: profile?.email,
        destination,
        email_sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results,
      date_checked: yesterdayStr,
    });
  } catch (err) {
    console.error('Review trigger error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
