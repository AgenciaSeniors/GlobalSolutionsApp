import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          // Aquí NO necesitamos options, así evitamos el no-unused-vars
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          // Aquí sí usamos options
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let user = null;

try {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('❌ supabase.auth.getUser error:', error);
  }

  user = data?.user ?? null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (err: any) {
  console.error('🔥 supabase.auth.getUser threw:', err);
  console.error('👉 cause:', err?.cause);
  console.error('👉 cause errors:', err?.cause?.errors);
}


  return { supabaseResponse, user };
}
