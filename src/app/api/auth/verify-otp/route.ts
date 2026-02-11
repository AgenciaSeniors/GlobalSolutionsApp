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

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // 1. Buscar el código en la tabla
    const { data: otpRow, error: fetchErr } = await supabaseAdmin
      .from('auth_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !otpRow) return NextResponse.json({ error: 'Código no encontrado o ya usado.' }, { status: 400 });

    // 2. Validar
    if (new Date(otpRow.expires_at) < now) return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    if (sha256(code.trim()) !== otpRow.code_hash) return NextResponse.json({ error: 'Código incorrecto.' }, { status: 400 });

    // 3. Marcar como verificado
    await supabaseAdmin.from('auth_otps').update({ used_at: now.toISOString(), verified_at: now.toISOString() }).eq('id', otpRow.id);

    // 4. GENERAR SESIÓN REAL (IMPORTANTE)
    // Usamos el método de Supabase para crear un link de acceso temporal
    const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo: '/dashboard' }
    });

    if (linkErr) throw linkErr;

    // Devolvemos el link que el frontend debe "navegar" para loguearse
    return NextResponse.json({ ok: true, sessionLink: data.properties.action_link });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}