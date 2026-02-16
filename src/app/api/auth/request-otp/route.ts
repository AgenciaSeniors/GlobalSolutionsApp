import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);


function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function random6Digits() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ Normalizar email SIEMPRE (evita mismatches en verify-otp)
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

    // ✅ Invalida OTPs anteriores no usados (marca como used_at)
    await supabaseAdmin
      .from('auth_otps')
      .update({ used_at: now.toISOString() })
      .eq('email', email)
      .is('used_at', null);

    // ✅ Genera nuevo código y almacena su hash
    const code = random6Digits();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from('auth_otps').insert({
      email,
      code_hash: sha256(code),
      expires_at: expiresAt,
      // used_at: null (default)
      // verified_at: null (default)
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

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

    const { ok: mailOk, error: mailErr } = await sendEmail({
  to: email,
  subject: 'Tu código de verificación (6 dígitos)',
  html: `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Tu código de verificación</h2>
      <p style="margin: 0 0 12px;">Usa este código para continuar:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; padding: 12px 16px; background: #f5f5f5; display: inline-block; border-radius: 10px;">
        ${code}
      </div>
      <p style="margin: 16px 0 0; color: #555;">Expira en <b>10 minutos</b>.</p>
      <p style="margin: 16px 0 0; color: #777;">— Global Solutions Travel</p>
    </div>
  `,
});

    if (mailErr) {
      return NextResponse.json({ error: mailErr.message }, { status: 500 });
    }

        return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
