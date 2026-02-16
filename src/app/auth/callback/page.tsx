'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function parseHashParams() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    token_type: params.get('token_type') ?? 'bearer',
    expires_in: params.get('expires_in'),
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      const supabase = createClient();

      const { access_token, refresh_token } = parseHashParams();

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          router.replace('/login?error=auth');
          return;
        }

        const next = searchParams.get('next') ?? '/panel';
        router.replace(next);
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace('/login?error=auth');
          return;
        }

        const next = searchParams.get('next') ?? '/panel';
        router.replace(next);
        return;
      }

      router.replace('/login?error=missing_params');
    })();
  }, [router, searchParams]);

  return <p>Autenticando...</p>;
}
