// src/app/api/auth/validate-credentials/route.ts
/**
 * 🔧 NUEVO ENDPOINT
 * Valida email + password server-side usando service_role.
 * NO crea sesión en el browser — solo confirma que las credenciales son correctas.
 * Esto evita el patrón problemático de signInWithPassword → signOut en el cliente.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ValidateBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(req: Request) {
  try {
    const body: ValidateBody = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos.' },
        { status: 400 },
      );
    }

    // Per-email brute-force lockout (max 5 failed attempts / 15 min).
    const throttleKey = `cred:${email}`;
    const { data: allowed } = await supabaseAdmin.rpc('auth_throttle_peek', { p_key: throttleKey, p_limit: 5 });
    if (allowed === false) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.' },
        { status: 429 },
      );
    }

    // Verificar que el usuario existe y tiene la contraseña correcta
    // Usamos signInWithPassword con el admin client — esto NO afecta cookies del browser
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Contar el fallo para el lockout; no revelar si el email existe (seguridad)
      await supabaseAdmin.rpc('auth_throttle_hit', { p_key: throttleKey, p_window_seconds: 900 });
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 },
      );
    }

    // Verificar que el email está confirmado
    if (!data.user?.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Debes confirmar tu email antes de iniciar sesión.' },
        { status: 403 },
      );
    }

    // ✅ Credenciales válidas — NO devolvemos tokens, solo confirmación
    return NextResponse.json({
      ok: true,
      userId: data.user.id,
    });
  } catch (e: unknown) {
    console.error('[validate-credentials]', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}