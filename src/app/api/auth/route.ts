// src/app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type NextCookieOptionsRaw = {
  domain?: string;
  path?: string;
  expires?: string | number | Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  [key: string]: unknown;
};

type CookieToSet = {
  name: string;
  value: string;
  options?: NextCookieOptionsRaw;
};

type PostBody = {
  session?: {
    access_token?: string;
    refresh_token?: string;
    [key: string]: unknown;
  } | null;
};

/**
 * Options shape compatible with NextResponse.cookies.set
 */
type SafeCookieOptions = {
  domain?: string;
  path?: string;
  expires?: number | Date;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  [key: string]: unknown;
};

function normalizeOptions(raw?: NextCookieOptionsRaw): SafeCookieOptions | undefined {
  if (!raw) return undefined;

  const opts: SafeCookieOptions = {};

  if (raw.domain !== undefined) opts.domain = String(raw.domain);
  if (raw.path !== undefined) opts.path = String(raw.path);
  if (raw.maxAge !== undefined) opts.maxAge = Number(raw.maxAge);
  if (raw.httpOnly !== undefined) opts.httpOnly = Boolean(raw.httpOnly);
  if (raw.secure !== undefined) opts.secure = Boolean(raw.secure);

  if (raw.sameSite !== undefined) {
    const v = raw.sameSite;
    if (v === 'lax' || v === 'strict' || v === 'none') opts.sameSite = v;
  }

  const e = raw.expires;
  if (e instanceof Date) {
    opts.expires = e;
  } else if (typeof e === 'number') {
    opts.expires = e;
  } else if (typeof e === 'string') {
    const parsed = Date.parse(e);
    if (!Number.isNaN(parsed)) opts.expires = new Date(parsed);
    else {
      const asNum = Number(e);
      if (!Number.isNaN(asNum)) opts.expires = asNum;
    }
  }

  // ✅ DEV FIX: browsers reject SameSite=None without Secure.
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    // En localhost, domain puede romper el set-cookie
    if (opts.domain) delete opts.domain;

    if (opts.secure) opts.secure = false;

    if (opts.sameSite === 'none') {
      // Importantísimo: si secure=false, sameSite no puede ser none
      opts.sameSite = 'lax';
    }
  }

  return opts;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    const { session } = body;

    const res = NextResponse.json({ ok: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              const safeOptions = normalizeOptions(options);
              if (safeOptions) res.cookies.set(name, value, safeOptions);
              else res.cookies.set(name, value);
            });
          },
        },
      },
    );

    try {
  if (session) {
    await supabase.auth.setSession({
      access_token: session.access_token ?? '',
      refresh_token: session.refresh_token ?? '',
    });
  } else {
    await supabase.auth.signOut();
  }
} catch (e) {
  console.error('api/auth setSession failed:', e);
  return NextResponse.json(
    { ok: false, error: String(e) },
    { status: 500 }
  );
}

return res;
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
