import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
console.log('[ADMIN_CLIENT] loaded admin.ts from src/lib/supabase/admin.ts');

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
