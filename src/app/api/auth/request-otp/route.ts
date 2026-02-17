// src/app/api/auth/request-otp/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/resend';

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

    // ✅ Normalizar email SIEMPRE
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

    // ✅ Invalida OTPs anteriores no usados
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

    // 🔧 FIX: sendEmail retorna { success, error? } — manejar correctamente
    const result = await sendEmail({
      to: email,
      subject: 'Tu código de verificación — Global Solutions Travel',
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; max-width: 480px; margin: 0 auto;">
          <h2 style="margin: 0 0 12px; color: #1a1a1a;">Tu código de verificación</h2>
          <p style="margin: 0 0 16px; color: #444;">Usa este código para continuar con tu inicio de sesión:</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 24px; background: #f5f5f5; display: inline-block; border-radius: 12px; font-family: ui-monospace, monospace; color: #111;">
            ${code}
          </div>
          <p style="margin: 20px 0 0; color: #666; font-size: 14px;">Expira en <b>10 minutos</b>. Si no solicitaste este código, ignora este mensaje.</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
          <p style="margin: 0; color: #999; font-size: 12px;">— Global Solutions Travel</p>
        </div>
      `,
    });

    // 🔧 FIX: Usar result.success (no result.ok)
    if (!result.success) {
      console.error('[request-otp] Email send failed:', result.error);
      return NextResponse.json(
        { error: 'No se pudo enviar el código. Intenta de nuevo.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}