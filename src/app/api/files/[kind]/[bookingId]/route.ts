export const runtime = 'nodejs';

/**
 * GET /api/files/voucher/:bookingId   (owner or staff)
 * GET /api/files/proof/:bookingId     (staff only)
 *
 * The `vouchers` and `payment-proofs` buckets are PRIVATE. This endpoint
 * authorizes the caller and 302-redirects to a short-lived signed URL, so
 * passenger vouchers (PNR/PII) and payment proofs are never publicly accessible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const KINDS = {
  voucher: { bucket: 'vouchers', column: 'voucher_pdf_url', staffOnly: false },
  proof: { bucket: 'payment-proofs', column: 'zelle_proof_url', staffOnly: true },
} as const;

/** Derive the storage object path from a stored value (full public URL or bare path). */
function objectPath(stored: string, bucket: string): string {
  const marker = `/${bucket}/`;
  const idx = stored.indexOf(marker);
  return idx >= 0 ? stored.slice(idx + marker.length) : stored;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { kind: string; bookingId: string } }
): Promise<NextResponse> {
  const cfg = KINDS[ctx.params.kind as keyof typeof KINDS];
  const bookingId = String(ctx.params.bookingId ?? '').trim();
  if (!cfg || !bookingId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(`/api/files/${ctx.params.kind}/${bookingId}`);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from('bookings')
    .select(`id, user_id, profile_id, assigned_agent_id, ${cfg.column}`)
    .eq('id', bookingId)
    .single();
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = booking.user_id === user.id || booking.profile_id === user.id;
  let isStaff = booking.assigned_agent_id === user.id;
  if (!isStaff) {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
    const role = typeof profile?.role === 'string' ? profile.role : '';
    isStaff = role === 'admin' || role === 'agent';
  }

  const authorized = cfg.staffOnly ? isStaff : isOwner || isStaff;
  if (!authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const stored = (booking as Record<string, unknown>)[cfg.column];
  if (typeof stored !== 'string' || !stored) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from(cfg.bucket)
    .createSignedUrl(objectPath(stored, cfg.bucket), 120);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
