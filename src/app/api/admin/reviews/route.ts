export const runtime = 'nodejs';

/**
 * PATCH /api/admin/reviews
 *
 * Secure endpoint for admins to approve or reject user reviews.
 * Uses service_role client to bypass RLS (the browser client's JWT does not
 * carry a custom 'role' claim, so RLS policies checking the role from the
 * profiles table fail when called directly from a Client Component).
 * Instead, we verify admin role server-side via the profiles table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate user via session cookies
    const supabaseAuth = await createClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    // 2. Verify admin role from profiles table (using admin client to avoid RLS on profiles)
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol admin.' }, { status: 403 });
    }

    // 3. Parse and validate request body
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Body inválido.', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { id, status } = parsed.data;

    // 4. Update review via admin client (bypasses RLS entirely)
    const { error } = await supabaseAdmin
      .from('reviews')
      .update({
        status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[admin/reviews] Update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno.';
    console.error('[admin/reviews] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
