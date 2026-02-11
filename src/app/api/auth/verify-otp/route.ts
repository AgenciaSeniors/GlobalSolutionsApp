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
    const body = await req.json();

    // ✅ Normalizar email (debe coincidir con request-otp)
    const email = String(body?.email ?? '').trim().toLowerCase();
    const code  = String(body?.code  ?? '').trim();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email y código son requeridos' },
        { status: 400 },
      );
    }

    // ✅ Validar formato: exactamente 6 dígitos
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'El código debe ser de 6 dígitos' },
        { status: 400 },
      );
    }

    const now = new Date();

    // ✅ Buscar el OTP más reciente para este email que NO haya sido usado
    const { data: otpRow, error: fetchErr } = await supabaseAdmin
      .from('auth_otps')
      .select('*')
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!otpRow) {
      return NextResponse.json(
        { error: 'No hay código pendiente. Solicita uno nuevo.' },
        { status: 400 },
      );
    }

    // ✅ Verificar que no haya expirado
    if (new Date(otpRow.expires_at) < now) {
      return NextResponse.json(
        { error: 'El código ha expirado. Solicita uno nuevo.' },
        { status: 400 },
      );
    }

    // ✅ Comparar hash del código enviado con el hash almacenado
    const submittedHash = sha256(code);

    if (submittedHash !== otpRow.code_hash) {
      return NextResponse.json(
        { error: 'Código incorrecto.' },
        { status: 400 },
      );
    }

    // ✅ Marcar como verificado (verified_at) — complete-register lo necesita
    const { error: updateErr } = await supabaseAdmin
      .from('auth_otps')
      .update({ verified_at: now.toISOString() })
      .eq('id', otpRow.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, verified: true });
  } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Error';
  return NextResponse.json({ error: message }, { status: 500 });
}
}