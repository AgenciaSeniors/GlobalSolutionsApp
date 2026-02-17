// src/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { v4 as uuidv4 } from "uuid"; // 🚀 NUEVO: Importamos uuid para el traceId

// 🛡️ Rate Limiting (best-effort, in-memory — complementa el rate limit en DB)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_THRESHOLD = 20;
const RATE_LIMIT_WINDOW = 60_000;

const PROTECTED_PREFIXES = ["/user", "/admin", "/agent", "/checkout", "/api/agent", "/api/admin"];
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

type Role = "admin" | "agent" | "client";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ─────────── 🚀 0.1) TRACE ID (Observabilidad) ─────────── */
  // Capturamos el traceId si ya viene en los headers, o generamos uno nuevo
  const traceId = request.headers.get("X-Trace-Id") ?? uuidv4();

  // Clonamos los headers para inyectar el traceId hacia las rutas de la API
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("X-Trace-Id", traceId);

  /* ─────────── 0.2) RATE LIMITING (solo API auth) ─────────── */
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
        { status: 429, headers: { "X-Trace-Id": traceId } } // 🚀 Inyectamos traceId en errores
      );
    }
  }

  const isAuthRoute = AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // 🔧 FIX: Rutas públicas o API de auth no protegidas — pasar directo
  if (!isAuthRoute && !isProtectedRoute) {
     // 🚀 Retornamos inyectando los headers clonados
     const publicResponse = NextResponse.next({
         request: { headers: requestHeaders }
     });
     publicResponse.headers.set("X-Trace-Id", traceId);
     return publicResponse;
  }

  /* ─────────── CREAR CLIENTE SUPABASE SSR ─────────── */
  // 🔧 FIX: Usar let para response porque setAll necesita reasignarlo
  // 🚀 Usamos los requestHeaders que contienen el traceId
  let response = NextResponse.next({
    request: { headers: requestHeaders }
  });

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
          // 🚀 Mantenemos los requestHeaders al recrear la respuesta
          response = NextResponse.next({
              request: { headers: requestHeaders }
          });
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
  if (isAuthRoute && user) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    redirectResponse.headers.set("X-Trace-Id", traceId); // 🚀
    return redirectResponse;
  }

  /* ─────────── 2) PROTEGER RUTAS (no autenticado) ─────────── */
  if (!user && isProtectedRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
          { error: "No autorizado" },
          { status: 401, headers: { "X-Trace-Id": traceId } } // 🚀
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set("X-Trace-Id", traceId); // 🚀
    return redirectResponse;
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
      const redirectResponse = NextResponse.redirect(new URL("/user/dashboard", request.url));
      redirectResponse.headers.set("X-Trace-Id", traceId); // 🚀
      return redirectResponse;
    }
    if (pathname.startsWith("/agent") && !["agent", "admin"].includes(role)) {
      const redirectResponse = NextResponse.redirect(new URL("/user/dashboard", request.url));
      redirectResponse.headers.set("X-Trace-Id", traceId); // 🚀
      return redirectResponse;
    }
  }

  // 🚀 Añadimos el traceId a la respuesta final exitosa
  response.headers.set("X-Trace-Id", traceId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};