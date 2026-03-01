export const runtime = 'nodejs';

/**
 * POST /api/admin/settings
 *
 * Secure endpoint for admins to update app_settings.
 * Uses service_role client to bypass RLS (the RLS policy checks
 * auth.jwt() ->> 'role' = 'admin', but Supabase JWTs use 'authenticated').
 * Instead, we verify admin role via the profiles table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_KEYS = new Set([
  'default_markup_percentage',
  'agent_markup_percentage',
  'min_markup_percentage',
  'max_markup_percentage',
  'stripe_fee_percentage',
  'stripe_fee_fixed',
  'paypal_fee_percentage',
  'paypal_fee_fixed',
  'zelle_fee_percentage',
  'zelle_fee_fixed',
  'emission_sla_hours',
  'emission_warning_hours',
  'review_request_delay_days',
  'loyalty_points_per_dollar',
  'business_name',
  'business_email',
  'business_phone',
  'business_address',
  'currency',
]);

const SettingSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const BodySchema = z.object({
  settings: z.array(SettingSchema).min(1).max(50),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate user via cookies
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error('[admin/settings] Auth error:', authError.message);
    }

    if (!user) {
      console.error('[admin/settings] No user found in session');
      return NextResponse.json({ error: 'No autenticado. Inicia sesion de nuevo.' }, { status: 401 });
    }

    console.log('[admin/settings] User:', user.id, user.email);

    // 2. Verify admin role from profiles table
    const supabaseAdmin = createAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[admin/settings] Profile fetch error:', profileError.message);
    }

    if (!profile || profile.role !== 'admin') {
      console.error('[admin/settings] User is not admin. Profile:', profile);
      return NextResponse.json({ error: 'Acceso denegado. Se requiere rol admin.' }, { status: 403 });
    }

    // 3. Parse and validate body
    const raw: unknown = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      console.error('[admin/settings] Validation error:', parsed.error.errors);
      return NextResponse.json(
        { error: 'Body invalido.', details: parsed.error.errors },
        { status: 400 },
      );
    }

    // 4. Filter to allowed keys only
    const validSettings = parsed.data.settings.filter((s) => ALLOWED_KEYS.has(s.key));

    if (validSettings.length === 0) {
      return NextResponse.json({ error: 'Ninguna key permitida en el request.' }, { status: 400 });
    }

    // 5. Upsert each setting via admin client (bypasses RLS)
    const now = new Date().toISOString();
    const errors: string[] = [];

    for (const setting of validSettings) {
      console.log('[admin/settings] Upserting:', setting.key, '=', setting.value);
      const { error } = await supabaseAdmin.from('app_settings').upsert(
        {
          key: setting.key,
          value: setting.value,
          updated_at: now,
          updated_by: user.id,
        },
        { onConflict: 'key' },
      );

      if (error) {
        console.error('[admin/settings] Upsert error for', setting.key, ':', error.message);
        errors.push(`${setting.key}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Algunos settings fallaron.', details: errors, saved: validSettings.length - errors.length },
        { status: 207 },
      );
    }

    console.log('[admin/settings] All settings saved successfully:', validSettings.length);
    return NextResponse.json(
      { success: true, saved: validSettings.length },
      { status: 200 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno.';
    console.error('[admin/settings] Unhandled error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
