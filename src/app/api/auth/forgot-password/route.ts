import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyPasswordReset } from '@/lib/email/notifications';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Rate-limit reset requests per email (max 5 / hour) and never reveal
    // whether the email exists (anti-enumeration / anti-spam).
    const key = `forgot:${String(email).trim().toLowerCase()}`;
    const { data: allowed } = await supabaseAdmin.rpc('auth_throttle_peek', { p_key: key, p_limit: 5 });
    if (allowed === false) {
      return NextResponse.json({ success: true });
    }
    await supabaseAdmin.rpc('auth_throttle_hit', { p_key: key, p_window_seconds: 3600 });

    // El client admin "generateLink" genera el magic link de manera segura SIN enviar email.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        // Apuntamos a nuestro propio callback que iniciará sesión y luego nos mandará a /update-password
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`
      }
    });

    // El email podría no existir — respondemos éxito igual para no filtrar (enumeración).
    const resetLink = data?.properties?.action_link;
    if (error || !resetLink) {
      return NextResponse.json({ success: true });
    }

    // Enviar nuestro correo personalizado usando Resend
    try {
      await notifyPasswordReset(email, { resetLink });
    } catch (mailErr) {
      console.error('[forgot-password] email send failed:', mailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}