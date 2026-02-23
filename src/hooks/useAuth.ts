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
    window.location.href = destination[role] || ROUTES.USER_DASHBOARD;
  }

  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (redirectTo && redirectTo.startsWith('/')) {
        window.location.href = redirectTo;
        return;
      }

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

  /**
   * Send customized password recovery email via our own API.
   */
  async function resetPassword(email: string) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al enviar enlace de recuperación');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { login, register, resetPassword, logout, isLoading };
}