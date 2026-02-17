// src/app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Parsea tokens del hash fragment (#access_token=...&refresh_token=...)
 */
function parseHashParams() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
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
      const next = searchParams.get('next') ?? '/user/dashboard';

      try {
        // ─────────────────────────────────────────────────────
        // 🔧 FIX PRINCIPAL: Verificar si la sesión YA existe.
        //
        // Cuando detectSessionInUrl: true (en client.ts), el
        // BrowserClient de Supabase intercepta el magic link y
        // hace setSession AUTOMÁTICAMENTE antes de que este
        // useEffect corra. Los tokens ya fueron consumidos y
        // limpiados de la URL.
        //
        // Si ya hay sesión → simplemente redirigir.
        // ─────────────────────────────────────────────────────
        const { data: { session: existingSession } } = await supabase.auth.getSession();

        if (existingSession) {
          console.log('[callback] Session already active, redirecting to:', next);
          if (!cancelled) router.replace(next);
          return;
        }

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

          // Limpiar hash por seguridad
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

        // ─────────────────────────────────────────────────────
        // 🔧 FIX: Último intento — esperar y re-verificar.
        // detectSessionInUrl puede estar procesando asincrónicamente.
        // ─────────────────────────────────────────────────────
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession) {
          console.log('[callback] Session found on retry, redirecting to:', next);
          if (!cancelled) router.replace(next);
          return;
        }

        // Realmente no hay nada
        console.error('[callback] No session, no tokens, no code found');
        if (!cancelled) setError('No se pudo establecer la sesión. Intenta de nuevo.');

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
          <a
            href="/login"
            className="mt-3 inline-block text-sm font-semibold text-brand-600 underline"
          >
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-neutral-500 animate-pulse">Autenticando...</p>
    </div>
  );
}
