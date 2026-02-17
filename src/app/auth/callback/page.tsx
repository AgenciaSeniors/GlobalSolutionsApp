// src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Parsea tokens del hash fragment (#access_token=...&refresh_token=...)
 * Supabase puede enviar tokens en el hash cuando usa implicit flow.
 */
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();

      // 🔧 FIX: Default redirect a /user/dashboard (consistente con middleware)
      const next = searchParams.get('next') ?? '/user/dashboard';

      try {
        // Intento 1: tokens en el hash fragment (implicit flow)
        const { access_token, refresh_token } = parseHashParams();

        if (access_token && refresh_token) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionErr) {
            console.error('[callback] setSession error:', sessionErr);
            if (!cancelled) setError('Error estableciendo sesión.');
            return;
          }

          // Limpiar el hash del URL por seguridad
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }

          if (!cancelled) router.replace(next);
          return;
        }

        // Intento 2: code en query params (PKCE flow)
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeErr) {
            console.error('[callback] exchangeCodeForSession error:', exchangeErr);
            if (!cancelled) setError('Error intercambiando código de autenticación.');
            return;
          }

          if (!cancelled) router.replace(next);
          return;
        }

        // Sin tokens ni code — algo salió mal
        console.error('[callback] No tokens or code found in URL');
        if (!cancelled) setError('Parámetros de autenticación faltantes.');
      } catch (err) {
        console.error('[callback] Unexpected error:', err);
        if (!cancelled) setError('Error inesperado en la autenticación.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-xl bg-red-50 px-6 py-4 text-sm text-red-700 border border-red-100 max-w-md text-center">
          <p className="font-medium">{error}</p>
          <p className="mt-2 text-red-500">Serás redirigido al login...</p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(() => window.location.href = '/login?error=auth', 3000)`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-neutral-500 animate-pulse">Autenticando...</p>
    </div>
  );
}
