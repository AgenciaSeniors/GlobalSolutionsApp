// src/lib/supabase/client.ts
/**
 * @fileoverview Cliente de Supabase para el navegador (Client Components).
 * Configurado para persistencia de sesión y autorenovación.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // 💾 Guarda la sesión en cookies del navegador (gestionadas por @supabase/ssr)
        persistSession: true,
        // 🔄 Renueva el JWT automáticamente antes de que expire
        autoRefreshToken: true,
        // 🔗 Detecta si el usuario viene de un link de confirmación/magic link
        detectSessionInUrl: true,
      },
    }
  );
}