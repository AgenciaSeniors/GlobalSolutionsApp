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

    // Verificar que el usuario existe y tiene la contraseña correcta
    // Usamos signInWithPassword con el admin client — esto NO afecta cookies del browser
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // No revelar si el email existe o no (seguridad)
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
    const message = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}