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

    if (!email || !code) {
      return NextResponse.json({ error: 'Email y código requeridos' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'El código debe ser de 6 dígitos' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('auth_otps')
      .select('*')
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }

    if (new Date(data.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Código expirado' }, { status: 400 });
    }

    if (sha256(code) !== data.code_hash) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }

    await supabaseAdmin.from('auth_otps').update({ verified_at: new Date().toISOString() }).eq('id', data.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
