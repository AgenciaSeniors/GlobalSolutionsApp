// middleware.ts
/**
 * Root middleware — refreshes Supabase session on every
 * request and protects dashboard routes.
 *
 * Protecciones añadidas:
 *  - updateSession está envuelto en try/catch para evitar 500s
 *    si updateSession lanza por cualquier razón.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = ['/admin', '/agent', '/user'];

export async function middleware(request: NextRequest) {
  // Default response
  let supabaseResponse = NextResponse.next({ request });
  let user: any = null;

  try {
    // Intentamos actualizar/leer la sesión — si falla, lo capturamos
    const result = await updateSession(request);
    supabaseResponse = result.supabaseResponse ?? supabaseResponse;
    user = result.user ?? null;
  } catch (err) {
    // No devolvemos 500 por problemas dentro de updateSession.
    // Logueamos para depuración y continuamos.
    console.error(
      '[middleware] updateSession lanzó una excepción — se continúa sin sesión:',
      err,
    );
    // supabaseResponse ya es NextResponse.next({ request })
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathname.startsWith(p),
  );

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static, _next/image, favicon.ico, public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
