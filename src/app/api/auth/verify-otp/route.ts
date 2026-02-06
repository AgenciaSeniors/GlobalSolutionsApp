import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function random6Digits() {
  return String(crypto.randomInt(100000, 1000000)); // ✅ siempre 6 dígitos
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ NORMALIZA EMAIL (esto arregla 80% de “Código inválido”)
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const now = new Date();

    // Rate limit: 1 request por 60s por email
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

    // ✅ Invalida OTPs anteriores NO consumidos
    const { error: invalidateErr } = await supabaseAdmin
      .from('auth_otps')
      .update({ consumed_at: now.toISOString() })
      .eq('email', email)
      .is('consumed_at', null);

    if (invalidateErr) {
      return NextResponse.json({ error: invalidateErr.message }, { status: 500 });
    }

    const code = random6Digits();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from('auth_otps').insert({
      email,
      code_hash: sha256(code),
      expires_at: expiresAt,
      // consumed_at queda null inicialmente
    });

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Upsert rate limit
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
      to: email, // ✅ email normalizado
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
