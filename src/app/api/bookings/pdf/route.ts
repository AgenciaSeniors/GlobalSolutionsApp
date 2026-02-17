import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Buffer } from 'buffer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookingVoucherDocument, type VoucherBooking } from '@/lib/pdf/bookingVoucher';

export const runtime = 'nodejs';
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('booking_id');

    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    if (!isUuid(bookingId)) {
  return NextResponse.json({ error: 'Invalid booking_id format' }, { status: 400 });
}


    // 1) Require auth
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    // 2) Requester role
    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const requesterRole = requesterProfile?.role ?? 'client';

    // 3) Fetch booking + relations
    const isPrivileged = requesterRole === 'admin' || requesterRole === 'agent';

// 🔒 Query base
let bookingQuery = supabaseAdmin
  .from('bookings')
  .select(
    `
      id,
      user_id,
      booking_code,
      airline_pnr,
      booking_status,
      payment_status,
      payment_method,
      subtotal,
      payment_gateway_fee,
      total_amount,
      profile:profiles!user_id(full_name, email),
      flight:flights(
        flight_number,
        departure_datetime,
        arrival_datetime,
        aircraft_type,
        airline:airlines(name, iata_code),
        origin_airport:airports!flights_origin_airport_id_fkey(iata_code, name, city),
        destination_airport:airports!flights_destination_airport_id_fkey(iata_code, name, city)
      ),
      passengers:booking_passengers(first_name, last_name, nationality, ticket_number)
    `
  )
  .eq('id', bookingId);

// 🔒 Si NO es admin/agent, solo permite reservas del mismo usuario
if (!isPrivileged) {
  bookingQuery = bookingQuery.eq('user_id', user.id);
}

const { data: booking, error: bookingError } = await bookingQuery.single();

if (bookingError || !booking) {
  return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
}


    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 4) Normalize embedded rows (Supabase can return arrays)
    const profileRow = Array.isArray(booking.profile) ? booking.profile[0] : booking.profile;

    const flightRow = Array.isArray(booking.flight) ? booking.flight[0] : booking.flight;

    const airlineRow = flightRow
      ? (Array.isArray(flightRow.airline) ? flightRow.airline[0] : flightRow.airline)
      : null;

    const originRow = flightRow
      ? (Array.isArray(flightRow.origin_airport) ? flightRow.origin_airport[0] : flightRow.origin_airport)
      : null;

    const destinationRow = flightRow
      ? (Array.isArray(flightRow.destination_airport)
          ? flightRow.destination_airport[0]
          : flightRow.destination_airport)
      : null;

    const normalizedFlight = flightRow
      ? {
          flight_number: flightRow.flight_number ?? null,
          departure_datetime: flightRow.departure_datetime ?? null,
          arrival_datetime: flightRow.arrival_datetime ?? null,
          aircraft_type: flightRow.aircraft_type ?? null,
          airline: airlineRow ?? null,
          origin_airport: originRow ?? null,
          destination_airport: destinationRow ?? null,
        }
      : null;

    const voucherBooking: VoucherBooking = {
      booking_code: booking.booking_code,
      airline_pnr: booking.airline_pnr,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method,
      subtotal: Number(booking.subtotal ?? 0),
      payment_gateway_fee: Number(booking.payment_gateway_fee ?? 0),
      total_amount: Number(booking.total_amount ?? 0),
      profile: (profileRow ?? null) as any,
      flight: (normalizedFlight ?? null) as any,
      passengers: (booking.passengers ?? []) as any,
    };

    // 5) Generate PDF
    const doc = React.createElement(BookingVoucherDocument as any, { booking: voucherBooking });

    // toBuffer() a veces queda tipado como Uint8Array -> lo normalizamos a Buffer
    const raw = await (pdf(doc as any) as any).toBuffer();
    const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    return new Response(body as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="voucher-${booking.booking_code}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PDF Voucher] Error:', message);
    return NextResponse.json({ error: 'Failed to generate voucher PDF' }, { status: 500 });
  }
}
