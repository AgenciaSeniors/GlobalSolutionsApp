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

    // 🔴 ANTES (Causaba el error de bucle):
    // router.refresh();
    // router.push(targetUrl);

    // 🟢 AHORA (Solución robusta):
    // Usamos window.location.href para forzar una recarga completa.
    // Esto asegura que el Middleware reciba las cookies frescas sí o sí.
    window.location.href = targetUrl;
  }

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch profile to determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      redirectByRole((profile?.role as UserRole) ?? 'client');
    } catch (error) {
       // Importante: Si falla el login, detenemos el loading aquí
       // para que el usuario pueda intentar de nuevo.
       console.error("Login error:", error);
       throw error;
    } finally {
       // Nota: Si redirigimos con window.location, la página se recargará,
       // así que el setIsLoading(false) visualmente no importa tanto si hay éxito,
       // pero es buena práctica mantenerlo.
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