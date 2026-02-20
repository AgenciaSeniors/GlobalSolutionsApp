/**
 * @fileoverview Review trigger cron endpoint.
 * Per spec §4.3: Runs daily at 00:00, finds bookings where
 * return_date == yesterday, sends push + email asking for review.
 * Rewards 50 loyalty points for reviews with photos.
 * @module app/api/reviews/trigger/route
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyReviewRequest } from '@/lib/email/notifications';


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find completed bookings where return_date was yesterday
    // and review hasn't been requested yet
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id, booking_code, profile_id, return_date, review_requested,
        flight:flights!bookings_flight_id_fkey(
          destination_airport:airports!flights_destination_airport_id_fkey(city)
        ),
        profile:profiles!bookings_user_id_fkey(full_name, email)
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
  // ✅ Normalizar relaciones: a veces vienen como arrays
  const profileRow = Array.isArray((booking as any).profile)
    ? (booking as any).profile[0]
    : (booking as any).profile;

  const flightRow = Array.isArray((booking as any).flight)
    ? (booking as any).flight[0]
    : (booking as any).flight;

  const destinationAirportRow = flightRow
    ? (Array.isArray(flightRow.destination_airport) ? flightRow.destination_airport[0] : flightRow.destination_airport)
    : null;

  const profile = (profileRow ?? null) as { full_name?: string | null; email?: string | null } | null;
  const destination = destinationAirportRow?.city || 'tu destino';


            // 1) Validaciones mínimas
      if (!profile?.email) {
        results.push({
          booking_id: booking.id,
          booking_code: booking.booking_code,
          user_email: null,
          destination,
          email_sent: false,
          email_error: 'Missing profile email',
          review_marked: false,
        });
        continue;
      }

      const clientName = profile.full_name || 'Cliente';

      // 2) Enviar email (si falla, NO marcamos review_requested)
      const emailResult = await notifyReviewRequest(profile.email, {
        clientName,
        bookingCode: booking.booking_code,
        destination,
      });

      // 3) Si el email salió bien, recién ahí marcamos review_requested=true
      let reviewMarked = false;

      if (emailResult.success) {
        const { error: markError } = await supabaseAdmin
          .from('bookings')
          .update({ review_requested: true, review_requested_at: new Date().toISOString() })
          .eq('id', booking.id);

        if (markError) {
          console.error('[Review Trigger] Could not mark review_requested:', markError);
          reviewMarked = false;
        } else {
          reviewMarked = true;
        }
      } else {
        console.error('[Review Trigger] Email failed:', emailResult.error);
      }

      // 4) Guardamos detalle en la respuesta
      results.push({
        booking_id: booking.id,
        booking_code: booking.booking_code,
        user_email: profile.email,
        destination,
        email_sent: emailResult.success,
        email_id: emailResult.id ?? null,
        email_error: emailResult.error ?? null,
        review_marked: reviewMarked,
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
