//src/app/api/bookings/route.ts
/**
 * @fileoverview
 *  - GET  /api/bookings  -> List bookings for authenticated user
 *  - PATCH /api/bookings -> Booking actions (REQUEST_CANCELLATION)
 *
 * NOTE: The new statuses ('cancellation_requested', 'emitted') require DB support
 * (CHECK/enum update) by Dev C.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(
        `
        *,
        flight:flights(*,
          airline:airlines(*),
          origin_airport:airports!origin_airport_id(*),
          destination_airport:airports!destination_airport_id(*)
        ),
        passengers:booking_passengers(*)
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const bookingId = body?.bookingId as string | undefined;
    const action = body?.action as string | undefined;

    if (!bookingId || !action) {
      return NextResponse.json({ error: 'bookingId y action son requeridos' }, { status: 400 });
    }

    if (action !== 'REQUEST_CANCELLATION') {
      return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
    }

    const { data: booking, error: findErr } = await supabase
      .from('bookings')
      .select('id, booking_status')
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single();

    if (findErr || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const current = String(booking.booking_status ?? '').toLowerCase();

    // Permitimos solicitar cancelación si está confirmada o emitida
    if (!['confirmed', 'emitted'].includes(current)) {
      return NextResponse.json(
        { error: 'Solo puedes solicitar cancelación para reservas confirmadas o emitidas' },
        { status: 409 },
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({ booking_status: 'cancellation_requested' })
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .select('id, booking_status')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
