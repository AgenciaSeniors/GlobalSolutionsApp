export const runtime = 'nodejs';

/**
 * GET /api/admin/booking-contact?booking_id=...
 *
 * Returns the client contact (email, phone, full_name) for a booking. Used by
 * the emission flow to email the voucher. Client contact columns are no longer
 * readable from the browser, so this runs with the service role and is scoped:
 * admins can read any booking; agents only their assigned bookings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
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
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const { data: me } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    const role = me?.role;
    if (role !== 'admin' && role !== 'agent') {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }

    const bookingId = req.nextUrl.searchParams.get('booking_id');
    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id requerido.' }, { status: 400 });
    }

    const { data: booking } = await admin
      .from('bookings')
      .select('user_id, assigned_agent_id')
      .eq('id', bookingId)
      .maybeSingle();
    if (!booking) {
      return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
    }
    if (role === 'agent' && booking.assigned_agent_id !== userId) {
      return NextResponse.json({ error: 'No autorizado para esta reserva.' }, { status: 403 });
    }

    const { data: contact } = await admin
      .from('profiles')
      .select('email, phone, full_name')
      .eq('id', booking.user_id)
      .maybeSingle();

    return NextResponse.json({ contact: contact ?? null });
  } catch (e: unknown) {
    console.error('[admin/booking-contact]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
