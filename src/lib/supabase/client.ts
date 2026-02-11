/**
 * @fileoverview Cliente de Supabase para el navegador (Client Components).
 * Configurado para persistencia de sesión y autorenovación.
 * @module lib/supabase/client
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // 💾 Guarda la sesión en las cookies/localStorage del navegador
        persistSession: true,
        // 🔄 Renueva la llave de acceso (JWT) automáticamente antes de que expire
        autoRefreshToken: true,
        // 🔗 Detecta si el usuario viene de un link de confirmación/magic link
        detectSessionInUrl: true,
      },
    }
  );
}
