export const runtime = 'nodejs';

/**
 * POST /api/loyalty/redeem
 *
 * Server-side point redemption. The `add_loyalty_points` RPC is no longer
 * executable by the `authenticated` role (it would let a user award themselves
 * arbitrary points), so redemption must go through this route, which:
 *  - identifies the user from the session (never trusts a client-supplied id),
 *  - verifies the balance, and
 *  - deducts points using the service-role client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BodySchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(1).max(200),
  referenceId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabaseAdmin = createAdminClient();

    // Authenticate via cookies (web) with Bearer fallback (native app WebView).
    let userId: string | null = null;
    const supabaseAuth = await createClient();
    const { data: { user: cookieUser } } = await supabaseAuth.auth.getUser();
    if (cookieUser) {
      userId = cookieUser.id;
    } else {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const { data: { user: tokenUser } } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
        userId = tokenUser?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Body inválido.', details: parsed.error.errors }, { status: 400 });
    }
    const { points, reason, referenceId } = parsed.data;

    // Verify sufficient balance (read with service role).
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('loyalty_points')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: 'Error consultando el saldo.' }, { status: 500 });
    }
    const current = profile?.loyalty_points ?? 0;
    if (current < points) {
      return NextResponse.json({ error: 'Puntos insuficientes para esta operación.' }, { status: 400 });
    }

    // Deduct atomically via the privileged RPC.
    const { error: rpcError } = await supabaseAdmin.rpc('add_loyalty_points', {
      p_user_id: userId,
      p_points: -points,
      p_reason: reason,
      p_ref_type: 'redemption',
      p_ref_id: referenceId ?? null,
    });

    if (rpcError) {
      return NextResponse.json({ error: 'No se pudo procesar la redención.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, balance: current - points });
  } catch (e: unknown) {
    console.error('[loyalty/redeem]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
