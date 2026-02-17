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
      // 🔧 FIX: Marcar como usado para que no se pueda reintentar
      await supabaseAdmin
        .from('auth_otps')
        .update({ used_at: now.toISOString() })
        .eq('id', otpRow.id);

      return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    }

    // 3) Validar Hash
    if (sha256(normalizedCode) !== otpRow.code_hash) {
      return NextResponse.json(
        { error: 'Código incorrecto.' },
        { status: 400 },
      );
    }

    // 4) 🔧 FIX: Marcar como usado Y verificado (antes solo se marcaba verified_at)
    await supabaseAdmin
      .from('auth_otps')
      .update({
        verified_at: now.toISOString(),
        used_at: now.toISOString(),
      })
      .eq('id', otpRow.id);

    // 5) Generar link de sesión con Supabase Admin
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/`,
      },
    });

    if (linkErr) throw linkErr;

    // --- AUDITORÍA DE SEGURIDAD ---
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
      // No bloquear el login si la auditoría falla
      console.error('[verify-otp] Audit log failed:', auditErr);
    }

    // 🔧 FIX: Extraer session link de forma robusta
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}