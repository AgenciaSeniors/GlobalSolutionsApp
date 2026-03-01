// src/app/api/dev/emit-voucher/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyEmissionComplete } from '@/lib/email/notifications';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // 2. Verify admin role
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }

    // 3. Process emission email
    const body = await request.json();
    const { email, clientName, invoiceId, pdfUrl, passengers, flights } = body;

    const mappedPassengers = (passengers ?? []).map((p: { fullName?: string; ticketNumber?: string }) => ({
      name: p.fullName,
      ticketNumber: p.ticketNumber,
    }));

    const result = await notifyEmissionComplete(email, {
      clientName: clientName,
      bookingCode: invoiceId,
      airlinePnr: passengers?.[0]?.pnr || 'N/A',
      flightNumber: flights?.[0]?.flightNumber || 'N/A',
      airline: flights?.[0]?.airline || 'N/A',
      origin: flights?.[0]?.origin || '',
      originCity: flights?.[0]?.origin || '',
      destination: flights?.[0]?.destination || '',
      destinationCity: flights?.[0]?.destination || '',
      departureDate: flights?.[0]?.date || '',
      passengers: mappedPassengers,
      voucherUrl: pdfUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[emit-voucher] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
