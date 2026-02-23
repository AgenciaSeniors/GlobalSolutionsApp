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

    // El client admin "generateLink" genera el magic link de manera segura SIN enviar email.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        // Apuntamos a nuestro propio callback que iniciará sesión y luego nos mandará a /update-password
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/update-password`
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const resetLink = data.properties.action_link;

    // Enviar nuestro correo personalizado usando Resend
    await notifyPasswordReset(email, { resetLink });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}