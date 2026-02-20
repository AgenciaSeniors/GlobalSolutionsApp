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

type MaybeArray<T> = T | T[];

function firstOrNull<T>(value: MaybeArray<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface AirportRow {
  city: string | null;
}

interface FlightRow {
  destination_airport: MaybeArray<AirportRow> | null;
}

interface ProfileRow {
  full_name: string | null;
  email: string | null;
}

interface BookingRow {
  id: string;
  booking_code: string;
  profile_id: string | null;
  return_date: string | null;
  review_requested: boolean | null;
  // Si quieres alinear con “reseña luego de pagar”, necesitamos traer payment_status:
  payment_status?: string | null;

  flight: MaybeArray<FlightRow> | null;
  profile: MaybeArray<ProfileRow> | null;
}

interface ResultRow {
  booking_id: string;
  booking_code: string | null;
  user_email: string | null;
  destination: string;
  email_sent: boolean;
  email_id?: string | null;
  email_error?: string | null;
  review_marked: boolean;
}

function formatDateYYYYMMDD(d: Date): string {
  // evita split('T') en ISO si quisieras; aquí mantenemos simple
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateYYYYMMDD(yesterday);

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id, booking_code, profile_id, return_date, review_requested, payment_status,
        flight:flights!bookings_flight_id_fkey(
          destination_airport:airports!flights_destination_airport_id_fkey(city)
        ),
        profile:profiles!bookings_user_id_fkey(full_name, email)
      `
      )
      .eq('booking_status', 'completed')
      .eq('return_date', yesterdayStr)
      .eq('review_requested', false)
      // ✅ Recomendado si tu regla nueva es "reseña después de pagar":
      .eq('payment_status', 'paid');

    if (error) {
      console.error('Review trigger query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedBookings: BookingRow[] = (bookings ?? []) as unknown as BookingRow[];
    const results: ResultRow[] = [];

    for (const booking of typedBookings) {
      const profileRow = firstOrNull(booking.profile);
      const flightRow = firstOrNull(booking.flight);
      const destinationAirportRow = flightRow ? firstOrNull(flightRow.destination_airport) : null;

      const destination = destinationAirportRow?.city ?? 'tu destino';

      // 1) Validaciones mínimas
      if (!profileRow?.email) {
        results.push({
          booking_id: booking.id,
          booking_code: booking.booking_code ?? null,
          user_email: null,
          destination,
          email_sent: false,
          email_error: 'Missing profile email',
          review_marked: false,
        });
        continue;
      }

      const clientName = profileRow.full_name ?? 'Cliente';

      // 2) Enviar email (si falla, NO marcamos review_requested)
      const emailResult = await notifyReviewRequest(profileRow.email, {
        clientName,
        bookingCode: booking.booking_code ?? '',
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
        booking_code: booking.booking_code ?? null,
        user_email: profileRow.email,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('Review trigger error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}