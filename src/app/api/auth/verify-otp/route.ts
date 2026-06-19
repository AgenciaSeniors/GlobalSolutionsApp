// src/app/api/auth/verify-otp/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { auditService } from '@/services/audit.service';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function sha256(input: string) {
  return crypto.createHash('sha256').update(input + (process.env.OTP_HASH_SECRET ?? '')).digest('hex');
}

type VerifyOtpBody = {
  email?: unknown;
  code?: unknown;
  mode?: unknown; // "login" | "register"
};

export async function POST(req: Request) {
  try {
    const body: VerifyOtpBody = await req.json();
    const email = typeof body.email === 'string' ? body.email : '';
    const code = typeof body.code === 'string' ? body.code : '';
    const modeRaw = typeof body.mode === 'string' ? body.mode : 'login';
    const mode: 'login' | 'register' = modeRaw === 'register' ? 'register' : 'login';

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json(
        { error: 'Email y código son requeridos.' },
        { status: 400 },
      );
    }

    const now = new Date();

    // 1) Buscar el código más reciente no usado
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

    // 2) Validar expiración
    if (new Date(otpRow.expires_at) < now) {
      // Marcar expirado como usado para que no se pueda reintentar con el mismo
      await supabaseAdmin
        .from('auth_otps')
        .update({ used_at: now.toISOString() })
        .eq('id', otpRow.id);

      return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    }

    // 3) Lockout: bound online brute-force of the 6-digit code. After
    // MAX_OTP_ATTEMPTS wrong guesses the code is invalidated and the user must
    // request a new one (which is itself rate-limited in request-otp).
    const MAX_OTP_ATTEMPTS = 5;
    const attempts = typeof otpRow.attempts === 'number' ? otpRow.attempts : 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin
        .from('auth_otps')
        .update({ used_at: now.toISOString() })
        .eq('id', otpRow.id);
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicita un nuevo código.' },
        { status: 429 },
      );
    }

    // 4) Validar Hash
    if (sha256(normalizedCode) !== otpRow.code_hash) {
      const newAttempts = attempts + 1;
      const locked = newAttempts >= MAX_OTP_ATTEMPTS;
      await supabaseAdmin
        .from('auth_otps')
        .update({
          attempts: newAttempts,
          ...(locked ? { used_at: now.toISOString() } : {}),
        })
        .eq('id', otpRow.id);
      return NextResponse.json(
        { error: locked ? 'Demasiados intentos. Solicita un nuevo código.' : 'Código incorrecto.' },
        { status: locked ? 429 : 400 },
      );
    }

    // 4) Marcar verificado (y usado solo si es login)
    if (mode === 'login') {
      await supabaseAdmin
        .from('auth_otps')
        .update({
          verified_at: now.toISOString(),
          used_at: now.toISOString(),
        })
        .eq('id', otpRow.id);
    } else {
      // register: NO consumimos el OTP aquí, para que complete-register lo pueda validar
      await supabaseAdmin
        .from('auth_otps')
        .update({
          verified_at: now.toISOString(),
        })
        .eq('id', otpRow.id);
    }

    // ✅ REGISTER: no generar sessionLink (solo validar código)
    if (mode === 'register') {
      return NextResponse.json({
        ok: true,
        verified: true,
      });
    }

    // 5) Generar magic link (válido para web y app nativa por igual)
    // El WebView de la app nativa navega al link, Supabase redirige de vuelta
    // a /auth/callback en nuestro dominio donde se establece la sesión.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/`,
      },
    });

    if (linkErr) throw linkErr;

    // --- AUDITORÍA DE SEGURIDAD (solo login) ---
    try {
      await auditService.log({
        userId: data.user?.id,
        action: 'LOGIN',
        entityType: 'auth',
        details: {
          method: 'OTP',
          email: normalizedEmail,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch (auditErr) {
      console.error('[verify-otp] Audit log failed:', auditErr);
    }

    const sessionLink =
      data?.properties?.action_link && typeof data.properties.action_link === 'string'
        ? data.properties.action_link
        : null;

    if (!sessionLink) {
      console.error('[verify-otp] No session link generated. data:', JSON.stringify(data));
      return NextResponse.json(
        { error: 'No se pudo generar el enlace de sesión.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      sessionLink,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error interno';
    console.error('[verify-otp] Error:', message);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
