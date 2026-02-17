// src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 🛡️ Rate Limiting (best-effort, in-memory — complementa el rate limit en DB)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_THRESHOLD = 20;
const RATE_LIMIT_WINDOW = 60_000;

const PROTECTED_PREFIXES = ["/user", "/admin", "/agent", "/checkout", "/api/agent", "/api/admin"];
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

type Role = "admin" | "agent" | "client";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ─────────── 0) RATE LIMITING (solo API auth) ─────────── */
  if (pathname.startsWith("/api/auth")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "127.0.0.1";
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
      rateData.count = 0;
      rateData.lastReset = now;
    }

    rateData.count++;
    rateLimitMap.set(ip, rateData);

    if (rateData.count > RATE_LIMIT_THRESHOLD) {
      return NextResponse.json(
        { error: "Demasiados intentos. Por seguridad, espera 1 minuto." },
        { status: 429 }
      );
    }
  }

  const isAuthRoute = AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // 🔧 FIX: Rutas públicas o API de auth no protegidas — pasar directo
  if (!isAuthRoute && !isProtectedRoute) return NextResponse.next();

  /* ─────────── CREAR CLIENTE SUPABASE SSR ─────────── */
  // 🔧 FIX: Usar let para response porque setAll necesita reasignarlo
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) => {
          // 🔧 FIX: Primero setear en request para que el siguiente handler las vea
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // 🔧 FIX: Recrear response con las cookies actualizadas del request
          response = NextResponse.next({ request });
          // 🔧 FIX: Setear cookies con options en la response (para el browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 🔧 FIX: getUser() refresca tokens automáticamente y setAll propaga las cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ─────────── 1) SI YA HAY SESIÓN, NO ENTRAR A /login ─────────── */
  // Redirige al home público — el usuario puede ir a su panel desde "Mi Panel" en el navbar
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  /* ─────────── 2) PROTEGER RUTAS (no autenticado) ─────────── */
  if (!user && isProtectedRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ─────────── 3) CONTROL DE ROLES ─────────── */
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/agent"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: Role }>();

    const role: Role = profile?.role ?? "client";

    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/user/dashboard", request.url));
    }
    if (pathname.startsWith("/agent") && !["agent", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/user/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};