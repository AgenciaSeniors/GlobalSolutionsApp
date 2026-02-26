import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ Normalizar email (consistente con request-otp y verify-otp)
    const email    = String(body?.email    ?? '').trim().toLowerCase();
    const fullName = String(body?.fullName ?? body?.full_name ?? '').trim();
    const password = String(body?.password ?? '');

    if (!email || !fullName || !password) {
      return NextResponse.json(
        { error: 'Email, nombre y contraseña requeridos' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 },
      );
    }

    // ✅ Buscar el OTP más reciente verificado y no consumido
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

    if (!otpRow?.verified_at) {
      return NextResponse.json(
        { error: 'Primero verifica el código.' },
        { status: 400 },
      );
    }

    // ✅ Verificar que la verificación no tenga más de 15 minutos
    const verifiedAt = new Date(otpRow.verified_at).getTime();
    if (Date.now() - verifiedAt > 15 * 60_000) {
      return NextResponse.json(
        { error: 'Verificación expirada. Solicita un nuevo código.' },
        { status: 400 },
      );
    }

    // ✅ Crear usuario en Supabase Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'client' },
    });

    if (createErr) {
      // Traducir errores de Supabase Auth a mensajes profesionales en español
      const errMsg = (createErr.message ?? '').toLowerCase();
      let userMessage = 'No se pudo crear la cuenta. Por favor intenta de nuevo.';

      if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        userMessage = 'Ya existe una cuenta con este correo electrónico. Intenta iniciar sesión.';
      } else if (errMsg.includes('password') && errMsg.includes('weak')) {
        userMessage = 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.';
      } else if (errMsg.includes('password')) {
        userMessage = 'La contraseña no cumple los requisitos mínimos de seguridad.';
      } else if (errMsg.includes('invalid') && errMsg.includes('email')) {
        userMessage = 'El correo electrónico no es válido.';
      } else if (errMsg.includes('rate') || errMsg.includes('limit')) {
        userMessage = 'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.';
      }

      return NextResponse.json({ error: userMessage }, { status: 400 });
    }

    // ✅ Marcar OTP como consumido (used_at) para que no se pueda reutilizar
    await supabaseAdmin
      .from('auth_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRow.id);

    return NextResponse.json({ ok: true, userId: created.user?.id });
  } catch (e: unknown) {
  const message = e instanceof Error ? e.message : 'Error';
  return NextResponse.json({ error: message }, { status: 500 });
}
}