// src/lib/supabase/server.ts
/**
 * @fileoverview Supabase client for Server Components, Route Handlers
 *               and Server Actions. Reads cookies via next/headers.
 *
 * ✅ Este archivo está correcto. Se usa en Server Components y Route Handlers.
 * Para middleware, las cookies se manejan directamente en middleware.ts.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can fail in a read-only context (RSC).
            // The middleware will handle refresh in that case.
          }
        },
      },
    },
  );
}