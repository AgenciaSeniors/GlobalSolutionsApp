import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 🛡️ Rate Limiting (solo API auth)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_THRESHOLD = 20;
const RATE_LIMIT_WINDOW = 60_000;

const PROTECTED_PREFIXES = ["/user", "/admin", "/agent", "/checkout", "/api/agent", "/api/admin"];
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password"];

type Role = "admin" | "agent" | "client";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ─────────── 0) RATE LIMITING ─────────── */
  if (pathname.startsWith("/api/auth")) {
    const ip = request.ip || "127.0.0.1";
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

  if (!isAuthRoute && !isProtectedRoute) return NextResponse.next();

  // ✅ const (fix prefer-const)
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dashboardMap: Record<Role, string> = {
    admin: "/admin/dashboard",
    agent: "/agent/dashboard",
    client: "/user/dashboard",
  };

  /* ─────────── 1) SI YA HAY SESIÓN, NO ENTRAR A /login ─────────── */
  if (isAuthRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: Role }>();

    const role: Role = profile?.role ?? "client";
    return NextResponse.redirect(new URL(dashboardMap[role] || "/user/dashboard", request.url));
  }

  /* ─────────── 2) PROTEGER RUTAS ─────────── */
  if (!user && isProtectedRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  /* ─────────── 3) CONTROL DE ROLES ─────────── */
  if (user) {
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
