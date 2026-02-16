/**
 * @fileoverview Auth callback handler.
 * Supabase redirects here after email confirmation, magic link, or OAuth.
 *
 * Handles TWO flows:
 *   1. PKCE flow  → ?code=...        → exchangeCodeForSession
 *   2. Magic link → ?token_hash=...&type=magiclink → verifyOtp
 *
 * After successful session creation, redirects to `?next=` or /panel.
 */
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type'); // magiclink, signup, recovery, etc.
  const next = searchParams.get('next') ?? '/panel';

  const cookieStore = cookies();

  const supabase = createServerClient(
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
            // setAll can fail in read-only context
          }
        },
      },
    },
  );

  let authError: Error | null = null;

  // Flow 1: PKCE code exchange (OAuth, email confirm with PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  }
  // Flow 2: Magic link / OTP token hash verification
  else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'magiclink' | 'signup' | 'recovery' | 'email',
    });
    authError = error;
  }
  // No auth params at all
  else {
    return NextResponse.redirect(new URL('/login?error=missing_params', origin));
  }

  if (!authError) {
    // Session created successfully — redirect to the target page
    const redirectUrl = new URL(next, origin);
    return NextResponse.redirect(redirectUrl);
  }

  console.error('[auth/callback] Error:', authError.message);
  return NextResponse.redirect(new URL('/login?error=auth', origin));
}
