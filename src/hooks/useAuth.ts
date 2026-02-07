/**
 * @fileoverview Custom hook encapsulating authentication actions.
 *
 * Per spec §3.1: Guest searches freely, login at checkout.
 * Supports optional `redirectTo` param so login redirects
 * back to checkout (or any page) after success.
 *
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

export function useAuth() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  /** Redirect user to the correct dashboard based on their role. */
  function redirectByRole(role: UserRole, redirectTo?: string) {
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }
    const destination: Record<UserRole, string> = {
      admin: ROUTES.ADMIN_DASHBOARD,
      agent: ROUTES.AGENT_DASHBOARD,
      client: ROUTES.USER_DASHBOARD,
    };
    router.push(destination[role]);
  }

  /**
   * Login with email + password.
   * @param redirectTo — optional URL to redirect after login (e.g. /checkout?flight=xxx)
   */
  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      redirectByRole((profile?.role as UserRole) ?? 'client', redirectTo);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push(ROUTES.HOME);
  }

  async function resetPassword(email: string) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { login, logout, resetPassword, isLoading };
}
