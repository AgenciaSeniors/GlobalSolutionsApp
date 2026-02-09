import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');

  // Server-only client (Service Role). Never import this from 'use client' code.
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
