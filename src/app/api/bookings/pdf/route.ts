export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Buffer } from 'buffer';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BookingVoucherDocument, type VoucherBooking } from '@/lib/pdf/bookingVoucher';

export const runtime = 'nodejs';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(request: NextRequest) {
  try {
    // Back-compat: accept ?id= OR ?booking_id=
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id') ?? searchParams.get('id');

    if (!bookingId) {
      return NextResponse.json({ error: 'Falta el ID de reserva' }, { status: 400 });
    }
    if (!isUuid(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking id format' }, { status: 400 });
    }

    // 1) Auth required
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 });
    }

    // 2) Admin client for complex relations (RLS bypass). We MUST check permissions ourselves.
    const supabaseAdmin = createAdminClient();

    // Optional: determine role to allow admins to view any voucher
    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const requesterRole = requesterProfile?.role ?? 'client';
    const isAdmin = requesterRole === 'admin';

    // 3) Fetch booking + relations
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        profile:profiles!user_id(full_name, email),
        flight:flights(
          flight_number, departure_datetime, arrival_datetime, aircraft_type,
          airline:airlines(name, iata_code),
          origin_airport:airports!origin_airport_id(iata_code, name, city),
          destination_airport:airports!destination_airport_id(iata_code, name, city)
        ),
        passengers:booking_passengers(first_name, last_name, ticket_number, nationality)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    // 4) SECURITY (IDOR): allow if owner or assigned agent, or admin role
    const isOwner = booking.user_id === user.id;
    const isAgent = booking.assigned_agent_id === user.id;

    if (!isAdmin && !isOwner && !isAgent) {
      console.warn(`[SECURITY] Unauthorized PDF access attempt booking=${bookingId} user=${user.id}`);
      return NextResponse.json({ error: 'Prohibido: No tienes permiso para ver esta reserva.' }, { status: 403 });
    }

    // 5) Normalize embedded rows (Supabase can return arrays)
    const profileRow = Array.isArray(booking.profile) ? booking.profile[0] : booking.profile;

    const flightRow = Array.isArray(booking.flight) ? booking.flight[0] : booking.flight;

    const airlineRow = flightRow
      ? (Array.isArray(flightRow.airline) ? flightRow.airline[0] : flightRow.airline)
      : null;

    const originRow = flightRow
      ? (Array.isArray(flightRow.origin_airport) ? flightRow.origin_airport[0] : flightRow.origin_airport)
      : null;

    const destinationRow = flightRow
      ? (Array.isArray(flightRow.destination_airport) ? flightRow.destination_airport[0] : flightRow.destination_airport)
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

    // 6) Generate PDF (binary)
    const doc = React.createElement(BookingVoucherDocument as any, { booking: voucherBooking });
    const raw = await (pdf(doc as any) as any).toBuffer();
    const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    return new Response(body as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GST-Voucher-${booking.booking_code}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PDF Voucher] Error:', message);
    return NextResponse.json({ error: 'Failed to generate voucher PDF' }, { status: 500 });
  }
}
