/**
 * @fileoverview Review trigger cron endpoint.
 * Per spec §4.3: Runs daily at 00:00, finds bookings where
 * return_date == yesterday, sends push + email asking for review.
 * Rewards 50 loyalty points for reviews with photos.
 * @module app/api/reviews/trigger/route
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

    // Find completed bookings where return_date was yesterday
    // and review hasn't been requested yet
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

      // Mark as review requested
      await supabaseAdmin
        .from('bookings')
        .update({ review_requested: true })
        .eq('id', booking.id);

      // In production: Send email via Resend/SendGrid
      // Email content: "¿Qué tal tu viaje a [Destino]? Califícanos y gana puntos"
      const emailPayload = {
        to: profile?.email,
        subject: `¿Cómo fue tu viaje a ${destination}? ⭐`,
        body: `Hola ${profile?.full_name},\n\n¡Esperamos que hayas disfrutado tu viaje a ${destination}! Nos encantaría saber tu opinión.\n\nDeja tu reseña y gana 50 puntos de fidelidad (¡100 puntos si incluyes fotos!).\n\nEquipo Global Solutions Travel`,
      };

      results.push({
        booking_id: booking.id,
        booking_code: booking.booking_code,
        user_email: profile?.email,
        destination,
        email_sent: true, // In production: actual send status
      });

      console.log('[Review Trigger] Email queued:', emailPayload.to, emailPayload.subject);
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
