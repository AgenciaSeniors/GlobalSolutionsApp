export const runtime = 'nodejs';

/**
 * POST /api/bookings/create
 *
 * Server-side booking creation. Previously this ran in the browser
 * (`bookingsService.create`), which (a) could not read the server-only
 * `PASSPORT_ENCRYPTION_KEY` and (b) trusted a client-computed `total_amount`,
 * allowing price tampering. This route:
 *   - authenticates the user from the session,
 *   - validates the flight + seat availability,
 *   - computes the authoritative price server-side (age multipliers + volatility
 *     buffer + gateway fee) via `calculateBookingTotal`,
 *   - inserts the booking with the server-computed total (not tamperable),
 *   - encrypts passengers server-side via `insert_encrypted_passenger`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateBookingTotal } from '@/lib/pricing/bookingPricing';

const PassengerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth debe ser YYYY-MM-DD'),
  nationality: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  passport_expiry_date: z.string().optional().nullable(),
});

const BodySchema = z.object({
  flight_id: z.string().uuid(),
  passengers: z.array(PassengerSchema).min(1).max(9),
});

function generateBookingCode(): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GST-${rand}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate (cookies + Bearer fallback for the native app WebView).
    const admin = createAdminClient();
    let userId: string | null = null;
    const supabaseAuth = await createClient();
    const { data: { user: cookieUser } } = await supabaseAuth.auth.getUser();
    if (cookieUser) {
      userId = cookieUser.id;
    } else {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const { data: { user: tokenUser } } = await admin.auth.getUser(authHeader.slice(7));
        userId = tokenUser?.id ?? null;
      }
    }
    if (!userId) {
      return NextResponse.json({ error: 'Debes iniciar sesión para reservar.' }, { status: 401 });
    }

    // 2. Validate body.
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos de reserva inválidos.', details: parsed.error.errors }, { status: 400 });
    }
    const { flight_id, passengers } = parsed.data;

    const secretKey = process.env.PASSPORT_ENCRYPTION_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Error interno de seguridad: llave de encriptación no configurada.' }, { status: 500 });
    }

    // 3. Validate flight + availability (read with service role).
    const { data: flight, error: flightErr } = await admin
      .from('flights')
      .select('final_price, available_seats')
      .eq('id', flight_id)
      .maybeSingle();

    if (flightErr || !flight) {
      return NextResponse.json({ error: 'Vuelo no encontrado.' }, { status: 404 });
    }
    if ((flight.available_seats ?? 0) < passengers.length) {
      return NextResponse.json({ error: 'No hay suficientes asientos disponibles.' }, { status: 409 });
    }

    // 4. Authoritative price (age multipliers + 3% buffer + gateway fee). Manual
    //    methods (zelle) have no gateway fee; payment method can change later.
    const breakdown = calculateBookingTotal(
      Number(flight.final_price),
      passengers.map((p) => ({ date_of_birth: p.date_of_birth })),
      'zelle',
    );

    // 5. Insert the booking with the server-computed total.
    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert({
        booking_code: generateBookingCode(),
        user_id: userId,
        profile_id: userId,
        flight_id,
        subtotal: breakdown.subtotal,
        payment_gateway_fee: breakdown.gateway_fee_amount,
        total_amount: breakdown.total_amount,
        payment_method: 'zelle',
        payment_status: 'pending',
        booking_status: 'pending_emission',
      })
      .select()
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Error creando la reserva.' }, { status: 500 });
    }

    // 6. Encrypt + insert passengers server-side.
    for (const p of passengers) {
      const { error: rpcError } = await admin.rpc('insert_encrypted_passenger', {
        p_booking_id: booking.id,
        p_first_name: p.first_name,
        p_last_name: p.last_name,
        p_date_of_birth: p.date_of_birth,
        p_nationality: p.nationality ?? null,
        p_passport_number: p.passport_number ?? null,
        p_passport_expiry_date: p.passport_expiry_date ?? null,
        p_secret_key: secretKey,
      });

      if (rpcError) {
        // Roll back the orphan booking so we don't leave a half-created reservation.
        await admin.from('bookings').delete().eq('id', booking.id);
        return NextResponse.json({ error: 'Error guardando datos protegidos de los pasajeros.' }, { status: 500 });
      }
    }

    return NextResponse.json({ booking });
  } catch (e: unknown) {
    console.error('[bookings/create]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
