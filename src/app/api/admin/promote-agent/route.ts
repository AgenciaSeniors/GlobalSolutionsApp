export const runtime = 'nodejs';

/**
 * POST /api/admin/promote-agent  { email, code, active }
 *
 * Promotes an existing user (found by email) to agent with a unique agent_code.
 * Runs with the service role (admin-gated) because looking a user up by email
 * and checking agent_code uniqueness both require reading sensitive profile
 * columns that are no longer readable from the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest): Promise<NextResponse> {
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
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const code = String(body?.code ?? '').trim().toUpperCase();
    const active = body?.active !== false;
    if (!email || !code) {
      return NextResponse.json({ error: 'Email y código requeridos.' }, { status: 400 });
    }

    const { data: found } = await admin
      .from('profiles').select('id, full_name').eq('email', email).maybeSingle();
    if (!found) {
      return NextResponse.json({ error: 'No se encontró un perfil con ese email.' }, { status: 404 });
    }

    const { data: dup } = await admin
      .from('profiles').select('id').eq('agent_code', code).neq('id', found.id).limit(1);
    if ((dup ?? []).length > 0) {
      return NextResponse.json({ error: `Ese código ya existe: ${code}` }, { status: 409 });
    }

    const { error: upErr } = await admin
      .from('profiles')
      .update({ role: 'agent', agent_code: code, is_active: active })
      .eq('id', found.id);
    if (upErr) {
      console.error('[admin/promote-agent]', upErr);
      return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, full_name: found.full_name });
  } catch (e: unknown) {
    console.error('[admin/promote-agent]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
