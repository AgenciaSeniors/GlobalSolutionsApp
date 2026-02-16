import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
// 1. Importamos el servicio
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

    // 2) Validar fechas
    if (new Date(otpRow.expires_at) < now) {
      return NextResponse.json({ error: 'Código expirado.' }, { status: 400 });
    }

    // 3) Validar Hash
    if (sha256(normalizedCode) !== otpRow.code_hash) {
      return NextResponse.json(
        { error: 'Código incorrecto.' },
        { status: 400 },
      );
    }

    // 4) Marcar como verificado en DB
    await supabaseAdmin
      .from('auth_otps')
      .update({ verified_at: now.toISOString() })
      .eq('id', otpRow.id);

    // 5) Generar link de sesión con Supabase
    // IMPORTANT: redirectTo must point to a route that EXISTS and can 
    // process the auth session. /auth/callback handles the PKCE code exchange.
    // If Supabase sends hash fragments instead, /panel will pick them up
    // via the browser client's detectSessionInUrl.
    const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/panel` },
    });

    if (linkErr) throw linkErr;

    // --- AUDITORÍA DE SEGURIDAD (Módulo 3) ---
    // ✅ Aquí es el lugar correcto: Ya validamos todo, tenemos el usuario (data.user)
    // y todavía no hemos devuelto la respuesta.
    await auditService.log({
      userId: data.user?.id, 
      action: 'LOGIN',
      entityType: 'auth',
      details: {
        method: 'OTP',
        email: normalizedEmail,
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      }
    });
    // ----------------------------------------

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
    const message = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}