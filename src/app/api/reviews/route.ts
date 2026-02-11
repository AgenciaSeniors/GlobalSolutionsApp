/**
 * @fileoverview POST /api/reviews — Create a review for a completed booking.
 * Awards loyalty points (via DB function add_loyalty_points) when review is created.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type CreateReviewPayload = {
  booking_id: string;
  rating: number;
  title?: string | null;
  comment: string;
  photo_urls?: string[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreateReviewPayload | null;
    if (!body || !body.booking_id || !body.comment || !Number.isFinite(body.rating)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating))));
    const photoUrls = Array.isArray(body.photo_urls) ? body.photo_urls : [];

    // 1) La booking debe existir, ser del usuario y estar completed
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('id, user_id, booking_status')
      .eq('id', body.booking_id)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }
    if (booking.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (booking.booking_status !== 'completed') {
      return NextResponse.json({ error: 'Solo se permiten reseñas de viajes completados' }, { status: 400 });
    }

    // 2) Evitar reseña duplicada
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', body.booking_id)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: 'Ya existe una reseña para esta reserva' }, { status: 409 });
    }

    // 3) Insertar reseña
    const { data: review, error: reviewErr } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        booking_id: body.booking_id,
        rating,
        title: body.title?.trim() || null,
        comment: body.comment.trim(),
        status: 'pending_approval',
        photo_urls: photoUrls,
      })
      .select('id')
      .single();

    if (reviewErr || !review) {
      return NextResponse.json({ error: reviewErr?.message || 'No se pudo crear la reseña' }, { status: 500 });
    }

    // 4) Puntos: 50 base, 100 si hay fotos
    const points = photoUrls.length > 0 ? 100 : 50;
    const { error: rpcErr } = await supabase.rpc('add_loyalty_points', {
      p_user_id: user.id,
      p_points: points,
      p_reason: 'review',
      p_ref_type: 'booking',
      p_ref_id: body.booking_id,
    });

    // Si el RPC no existe, no rompemos el flujo del usuario
    if (rpcErr) {
      console.warn('[reviews] add_loyalty_points RPC error:', rpcErr);
    }

    return NextResponse.json({ success: true, review_id: review.id, points_awarded: rpcErr ? 0 : points });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
