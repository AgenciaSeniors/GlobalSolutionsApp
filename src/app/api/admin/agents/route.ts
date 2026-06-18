export const runtime = 'nodejs';

/**
 * GET /api/admin/agents
 *
 * Returns agent profiles (including sensitive fields like agent_fund_cents and
 * email) for the admin dashboard. Reading these from the browser is no longer
 * possible — agent_fund_cents is revoked from anon/authenticated — so this
 * route serves them with the service role after verifying the caller is admin.
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

    const { data: profile, error: profileErr } = await admin
      .from('profiles').select('role').eq('id', userId).maybeSingle();
    if (profileErr) {
      return NextResponse.json({ error: 'Error verificando permisos.' }, { status: 500 });
    }
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol admin.' }, { status: 403 });
    }

    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('role', 'agent')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ agents: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
