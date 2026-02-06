import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // SOLO SERVER
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function random6Digits() {
  // 100000..999999
  return String(crypto.randomInt(100000, 1000000));
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    // Rate limit básico: 1 envío cada 60s por email
    const now = new Date();
    const { data: rl } = await supabaseAdmin
      .from('auth_otp_rate_limits')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (rl?.last_sent_at) {
      const diffMs = now.getTime() - new Date(rl.last_sent_at).getTime();
      if (diffMs < 60_000) {
        return NextResponse.json(
          { error: 'Espera 60 segundos antes de solicitar otro código.' },
          { status: 429 },
        );
      }
    }

    // invalidar códigos anteriores no consumidos
    await supabaseAdmin
      .from('auth_otps')
      .update({ consumed_at: now.toISOString() })
      .eq('email', email)
      .is('consumed_at', null);

    const code = random6Digits(); // ✅ SIEMPRE 6 dígitos
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from('auth_otps').insert({
      email,
      code_hash: sha256(code),
      expires_at: expiresAt,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // actualizar rate limit
    if (rl) {
      await supabaseAdmin
        .from('auth_otp_rate_limits')
        .update({ last_sent_at: now.toISOString(), send_count: (rl.send_count ?? 0) + 1 })
        .eq('email', email);
    } else {
      await supabaseAdmin
        .from('auth_otp_rate_limits')
        .insert({ email, last_sent_at: now.toISOString(), send_count: 1 });
    }

    const from = process.env.RESEND_FROM ?? 'Global Solutions Travel <onboarding@resend.dev>';

    const { error: mailErr } = await resend.emails.send({
      from,
      to: email,
      subject: 'Tu código de verificación (6 dígitos)',
      text: `Tu código es: ${code}\n\nExpira en 10 minutos.\n\n— Global Solutions Travel`,
    });

    if (mailErr) {
      return NextResponse.json({ error: mailErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
