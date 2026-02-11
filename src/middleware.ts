import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// 🛡️ Definimos las rutas protegidas (URLs reales del navegador)
const PROTECTED_PREFIXES = ['/user', '/admin', '/agent', '/checkout', '/api/agent', '/api/admin'];
const AUTH_PREFIXES = ['/login', '/register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const isAuthRoute = AUTH_PREFIXES.some(p => pathname.startsWith(p));
  const isProtectedRoute = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));

  if (!isAuthRoute && !isProtectedRoute) {
    return response;
  }

  // 🛠️ Configuración con tipos explícitos para eliminar los subrayados
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  /* ─────────── 1. REDIRECCIÓN SI YA TIENE SESIÓN ─────────── */
  if (isAuthRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (profile as any)?.role || 'client';
    
    const dashboardMap: Record<string, string> = {
      admin: '/admin/dashboard',
      agent: '/agent/dashboard',
      client: '/user/dashboard',
    };

    return NextResponse.redirect(new URL(dashboardMap[role] || '/user/dashboard', request.url));
  }

  /* ─────────── 2. PROTECCIÓN SI NO ESTÁ LOGUEADO ─────────── */
  if (!user && isProtectedRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ─────────── 3. CONTROL DE ROLES ─────────── */
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = (profile as any)?.role || 'client';

    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/user/dashboard', request.url));
    }
    if (pathname.startsWith('/agent') && !['agent', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/user/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};