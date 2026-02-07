// src/hooks/useAuth.ts
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

export function useAuth() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  function redirectByRole(role: UserRole) {
    const destination: Record<UserRole, string> = {
      admin: ROUTES.ADMIN_DASHBOARD,
      agent: ROUTES.AGENT_DASHBOARD,
      client: ROUTES.USER_DASHBOARD,
    };
    router.replace(destination[role]);
    router.refresh();
  }

  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Esperar que la sesión persista y esté disponible al server
      await supabase.auth.getSession();

      // Prioridad 1: redirect explícito pasado como argumento.
      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // Prioridad 2: ?redirect= en la URL (middleware)
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

      // Fallback: redirigir por rol (leer profile)
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

      redirectByRole(profile.role as UserRole);
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
        options: { data: { full_name: fullName, role: 'client' } },
      });
      if (error) throw error;
      router.push(`${ROUTES.LOGIN}?confirmed=pending`);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push(ROUTES.HOME);
  }

  return { login, register, logout, isLoading };
}
