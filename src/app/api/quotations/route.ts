/**
 * @fileoverview POST /api/quotations — Create a quotation request.
 * Per spec §3.3: When no flights found, user submits form.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('quotation_requests').insert({
      user_id: user?.id || null,
      guest_name: body.guest_name || null,
      guest_email: body.guest_email,
      guest_phone: body.guest_phone || null,
      origin: body.origin,
      destination: body.destination,
      departure_date: body.departure_date,
      return_date: body.return_date || null,
      passengers: body.passengers || 1,
      trip_type: body.trip_type || 'roundtrip',
      notes: body.notes || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Quotation request created' }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
