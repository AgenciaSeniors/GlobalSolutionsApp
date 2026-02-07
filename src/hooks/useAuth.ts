// src/hooks/useAuth.ts
/**
 * @fileoverview Custom hook encapsulating authentication actions
 *               (login, register, logout) with role-based redirect.
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Hook: useAuth
 *
 * - login(email, password, redirectTo?) accepts an optional third parameter
 *   that forces a redirect after successful auth (useful when caller already
 *   computed a desired redirect).
 */
export function useAuth() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  /** Redirect user to the correct dashboard based on their role. */
  function redirectByRole(role: UserRole) {
    const destination: Record<UserRole, string> = {
      admin: ROUTES.ADMIN_DASHBOARD,
      agent: ROUTES.AGENT_DASHBOARD,
      client: ROUTES.USER_DASHBOARD,
    };
    router.replace(destination[role]);
    router.refresh();
  }

  /**
   * Login with email + password.
   *
   * @param email
   * @param password
   * @param redirectTo optional explicit redirect path (e.g. '/panel' or '/checkout')
   */
  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Esperar que la sesión persista y esté disponible al server
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Sincronizar session con el servidor (escribe cookies sb-*)
      if (session) {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session }),
        });
      }

      // 1) Si caller pasó redirectTo, respetarlo
      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // 2) Si middleware agregó ?redirect= en la URL, respetarlo
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const redirectParam = params.get('redirect');
          if (redirectParam) {
            router.replace(redirectParam);
            router.refresh();
            return;
          }
        }
      } catch {
        // ignore
      }

      // 3) fallback: redirigir por rol leyendo profile
      const userId = data?.user?.id;
      if (!userId) {
        router.replace(ROUTES.USER_DASHBOARD);
        router.refresh();
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) {
        router.replace(ROUTES.USER_DASHBOARD);
        router.refresh();
        return;
      }

      const role = (profile?.role as UserRole | undefined) ?? 'client';
      redirectByRole(role);
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
        },
      });

      if (error) throw error;

      // After sign-up the user will receive a confirmation email.
      router.push(`${ROUTES.LOGIN}?confirmed=pending`);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();

      // Avisar al servidor para limpiar cookies
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: null }),
      });

      router.push(ROUTES.HOME);
    } finally {
      setIsLoading(false);
    }
  }

  return { login, register, logout, isLoading };
}
