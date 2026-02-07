// src/lib/supabase/middleware.ts
/**
 * Middleware helper that refreshes the Supabase session on
 * every request, keeping the auth cookie alive.
 *
 * Protecciones añadidas / tipado:
 *  - Tipos explícitos para cookiesToSet y sus campos.
 *  - No asumimos que request.cookies.set exista (puede ser read-only).
 *  - Siempre escribimos las cookies en la respuesta (supabaseResponse).
 *  - Logging para facilitar depuración.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieOptions = {
  // Opcional: definimos un shape flexible para las options de cookie.
  // Si quieres, puedes reemplazar por el tipo exacto de Next.js.
  [key: string]: any;
};

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type UpdateSessionResult = {
  supabaseResponse: NextResponse;
  user: any | null;
};

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // 1) Intentamos escribir en request.cookies si existe set (no confiamos en ello).
          try {
            const maybeSet = (request.cookies as any)?.set;
            if (typeof maybeSet === 'function') {
              cookiesToSet.forEach((cookie: CookieToSet) => {
                const { name, value, options } = cookie;
                try {
                  (request.cookies as any).set(name, value, options);
                } catch (e) {
                  // Puede fallar en contextos read-only; ignoramos el fallo por cookie.
                }
              });
            }
          } catch (err) {
            // No hacemos fallar la petición por esto; lo logueamos y seguimos.
            console.warn(
              '[supabase/middleware] request.cookies.set no disponible o falló (se ignorará).',
              err,
            );
          }

          // 2) Siempre escribimos en la respuesta: esto sí funciona en middleware.
          try {
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach((cookie: CookieToSet) => {
              const { name, value, options } = cookie;
              // options puede ser undefined; NextResponse.cookies.set acepta (name, value, options)
              supabaseResponse.cookies.set(name, value, options as any);
            });
          } catch (err) {
            console.error(
              '[supabase/middleware] fallo al establecer cookies en la respuesta',
              err,
            );
            // No lanzamos: preferimos continuar sin bloquear la petición.
          }
        },
      },
    },
  );

  // Refresh session — IMPORTANT: do NOT remove this call.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabaseResponse, user: user ?? null };
  } catch (err) {
    // Si falla getUser devolvemos supabaseResponse y user = null
    // para que la middleware llamante pueda decidir (no queremos 500 por aquí).
    console.error('[supabase/middleware] supabase.auth.getUser falló:', err);
    return { supabaseResponse, user: null };
  }
}
