/**
 * @fileoverview Auth service for server-side authentication operations.
 * @module services/auth.service
 */
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/models';

async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data as Profile | null;
}

async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) throw error;
}

export const authService = { getCurrentProfile, updateProfile };
