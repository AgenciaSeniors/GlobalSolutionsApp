import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

type VerifyOtpBody = {
  email?: unknown;
  code?: unknown;
};

export async function POST(req: Request) {
  try {
    const body: VerifyOtpBody = await req.json();
    const email = typeof body.email === 'string' ? body.email : '';
    const code = typeof body.code === 'string' ? body.code : '';

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json(
        { error: 'Email y código son requeridos.' },
        { status: 400 },
      );
    }

    const now = new Date();

    // 1) Buscar el código en la tabla
    const { data: otpRow, error: fetchErr } = await supabaseAdmin
      .from('auth_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !otpRow) {
      return NextResponse.json(
        { error: 'Código no encontrado o ya usado.' },
        { status: 400 },
      );
    }

    // 2) Validar
    if (new Date(otpRow.expires_at) < now) {
      return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    }

    if (sha256(normalizedCode) !== otpRow.code_hash) {
      return NextResponse.json(
        { error: 'Código incorrecto.' },
        { status: 400 },
      );
    }

    // 3) Marcar como verificado
    await supabaseAdmin
      .from('auth_otps')
      .update({ used_at: now.toISOString(), verified_at: now.toISOString() })
      .eq('id', otpRow.id);

    // 4) Generar link de sesión
    const { data, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: { redirectTo: '/dashboard' },
      });

    if (linkErr) throw linkErr;

    const sessionLink =
      data?.properties?.action_link && typeof data.properties.action_link === 'string'
        ? data.properties.action_link
        : null;

    return NextResponse.json({
      ok: true,
      verified: true,
      sessionLink,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
