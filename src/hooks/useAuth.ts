/**
 * @fileoverview Custom hook encapsulating authentication actions
 * (login, register, logout) with role-based redirect.
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

    const targetUrl = destination[role] || ROUTES.USER_DASHBOARD;
    window.location.href = targetUrl;
  }

  /**
   * Login and ensure the session is synced to server-side cookies before navigating.
   * If `redirectTo` is provided (e.g. from `?redirect=/user/dashboard`), it takes precedence.
   */
  async function login(email: string, password: string, redirectTo?: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // ✅ CLAVE: sincroniza la sesión con cookies server-side para que el middleware la vea
      if (data.session) {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ session: data.session }),
        });
      }

      // Si venimos de una ruta protegida, el middleware envía /login?redirect=/...
      // Respetamos ese destino (solo rutas internas).
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
        },
      });

      if (error) throw error;

      router.push(`${ROUTES.LOGIN}?confirmed=pending`);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    // También usamos navegación fuerte al salir para limpiar cualquier estado en memoria
    window.location.href = ROUTES.HOME;
  }

  return { login, register, logout, isLoading };
}
