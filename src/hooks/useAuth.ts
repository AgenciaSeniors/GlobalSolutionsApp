/**
 * @fileoverview Custom hook encapsulating authentication actions
 * (login, register, logout) with role-based redirect.
 *
 * IMPORTANT: createBrowserClient from @supabase/ssr already stores
 * session tokens in cookies automatically. There is NO need for a
 * separate /api/auth endpoint to "sync" cookies. That pattern was
 * from the old @supabase/auth-helpers and is now harmful — it
 * overwrites valid cookies with potentially broken ones.
 *
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export function useAuth() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  /** Redirect user to the correct dashboard based on their role. */
  function redirectByRole(role: UserRole) {
    const destination: Record<UserRole, string> = {
      admin: ROUTES.ADMIN_DASHBOARD,
      agent: ROUTES.AGENT_DASHBOARD,
      client: ROUTES.USER_DASHBOARD,
    };
    // Full page navigation so the middleware sees the fresh cookies
    window.location.href = destination[role] || ROUTES.USER_DASHBOARD;
  }

  /**
   * Login with email + password.
   * After signInWithPassword(), @supabase/ssr's createBrowserClient
   * automatically stores the session in cookies. We just need to
   * trigger a full-page navigation so the middleware picks them up.
   */
  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // NOTE: No /api/auth call needed!
      // createBrowserClient already stored the session in cookies.

      // If we came from a protected route (?redirect=/...), go back there
      if (redirectTo && redirectTo.startsWith('/')) {
        window.location.href = redirectTo;
        return;
      }

      // Otherwise, fetch role and redirect to the correct dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      redirectByRole((profile?.role as UserRole) ?? 'client');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function register({ email, password, fullName }: RegisterPayload) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: 'client' },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = ROUTES.HOME;
  }

  return { login, register, logout, isLoading };
}