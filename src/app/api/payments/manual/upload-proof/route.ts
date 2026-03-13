export const runtime = 'nodejs';

/**
 * POST /api/payments/manual/upload-proof
 *
 * Uploads a payment proof image for any manual payment method.
 * Accepts multipart/form-data with fields: booking_id, file.
 *
 * - Authenticated user
 * - Client: booking must belong to user
 * - Staff (admin/agent): can upload for any booking
 * - Booking must use a manual payment method (zelle, pix, spei, square)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MANUAL_METHODS = new Set(['zelle', 'pix', 'spei', 'square']);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await req.formData();
    const bookingId = formData.get('booking_id');
    const file = formData.get('file');

    if (!bookingId || typeof bookingId !== 'string') {
      return NextResponse.json({ error: 'booking_id requerido' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo muy grande (maximo 5 MB)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido (JPG, PNG, WebP, PDF)' }, { status: 400 });
    }

    // 3. Verify role and booking ownership
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isStaff = profile?.role === 'admin' || profile?.role === 'agent';

    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, user_id, profile_id, payment_method, booking_code')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
    if (!isStaff && !isOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!MANUAL_METHODS.has(booking.payment_method ?? '')) {
      return NextResponse.json({ error: 'Esta reserva no usa un metodo de pago manual' }, { status: 400 });
    }

    // 4. Upload file to Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${bookingId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from('payment-proofs')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[Manual Upload] Storage error:', uploadErr.message);
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
    }

    // 5. Get public URL
    const { data: urlData } = admin.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const proofUrl = urlData.publicUrl;

    // 6. Update booking with proof URL (reusing zelle_proof_url column for all methods)
    const { error: updateErr } = await admin
      .from('bookings')
      .update({ zelle_proof_url: proofUrl })
      .eq('id', bookingId);

    if (updateErr) {
      console.error('[Manual Upload] Booking update error:', updateErr.message);
      return NextResponse.json({ error: 'Error al vincular comprobante' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      proof_url: proofUrl,
      booking_code: booking.booking_code,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    console.error('[Manual Upload] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
