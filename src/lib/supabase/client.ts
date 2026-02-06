/**
 * @fileoverview Supabase client for browser / Client Components.
 *               Uses the anon key which is safe to expose publicly.
 * @module lib/supabase/client
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
