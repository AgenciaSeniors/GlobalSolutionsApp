export const runtime = 'nodejs';

/**
 * GET /api/me/profile
 *
 * Returns the authenticated user's OWN full profile row. Sensitive profile
 * columns (email, phone, loyalty_points, agent_fund_cents, agent_code) are no
 * longer readable by the browser via column grants, so own-row reads that need
 * them go through this service-role route after verifying the session.
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

    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[me/profile]', error);
      return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
    return NextResponse.json({ profile: data });
  } catch (e: unknown) {
    console.error('[me/profile]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
