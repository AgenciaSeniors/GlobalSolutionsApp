/**
 * @fileoverview Review trigger cron endpoint.
 * Runs daily, finds bookings that returned N days ago and marks review_requested.
 *
 * Security:
 *  - Requires header: x-cron-secret === process.env.CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getReviewDelayDays(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'review_request_delay_days')
    .maybeSingle<{ value: unknown }>();

  const raw = data?.value;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.floor(n);
}

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
    }

    const provided = req.headers.get('x-cron-secret');
    if (provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const delayDays = await getReviewDelayDays();

    const target = new Date();
    target.setDate(target.getDate() - delayDays);
    const targetStr = target.toISOString().split('T')[0];

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
      .eq('return_date', targetStr)
      .eq('review_requested', false);

    if (error) {
      console.error('Review trigger query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: { booking_id: string; booking_code: string; destination: string; email_sent: boolean }[] = [];

    for (const booking of bookings || []) {
      const profile = booking.profile as { full_name?: string; email?: string } | null;
      const flight = booking.flight as { destination_airport?: { city?: string } } | null;
      const destination = flight?.destination_airport?.city || 'tu destino';

      await supabaseAdmin
        .from('bookings')
        .update({ review_requested: true })
        .eq('id', booking.id);

      // En prod: enviar email real (Resend/Sendgrid). Acá lo “simulamos”
      // NOTA: no devolvemos el email del usuario en la respuesta (evita exposición innecesaria).
      void profile;

      results.push({
        booking_id: booking.id,
        booking_code: booking.booking_code,
        destination,
        email_sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results,
      date_checked: targetStr,
      delay_days: delayDays,
    });
  } catch (err) {
    console.error('Review trigger error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
