/**
 * @fileoverview Next.js Middleware — Route protection by role.
 *
 * Per spec §3.1: "Guest puede buscar vuelos sin login.
 * Login se exige SOLO al momento de comprar (checkout)."
 *
 * Public routes (no auth required):
 *   /, /flights, /flights/search, /flights/[id], /offers, /cars,
 *   /about, /quote-request, /legal/*
 *
 * Auth routes (redirect if already logged in):
 *   /login, /register, /forgot-password
 *
 * Protected routes (redirect to login if not authenticated):
 *   /checkout, /user/*, /agent/*, /admin/*
 *
 * Role-based access:
 *   /admin/* → role=admin only
 *   /agent/* → role=agent or admin
 *   /user/*  → role=client, agent, or admin
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create Supabase server client using request cookies
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session (important for SSR)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ─────────── Auth routes (login/register) ─────────── */
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')) {
    if (user) {
      // Already logged in — redirect to appropriate dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || 'client';
      const dashboardMap: Record<string, string> = {
        admin: '/admin/dashboard',
        agent: '/agent/dashboard',
        client: '/user/dashboard',
      };
      return NextResponse.redirect(new URL(dashboardMap[role], request.url));
    }
    return response;
  }

  /* ─────────── Protected: Checkout ─────────── */
  if (pathname.startsWith('/checkout')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  /* ─────────── Protected: Dashboard routes ─────────── */
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/agent') ||
    pathname.startsWith('/user')
  ) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Fetch role for authorization
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'client';

    // Admin routes — admin only
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Agent routes — agent or admin
    if (pathname.startsWith('/agent') && !['agent', 'admin'].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // User routes — any authenticated user
    return response;
  }

  /* ─────────── Public routes — no auth needed ─────────── */
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes EXCEPT:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, images, etc.
     * - API routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|images|api).*)',
  ],
};
