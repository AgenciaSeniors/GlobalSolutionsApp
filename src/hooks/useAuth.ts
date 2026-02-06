/**
 * @fileoverview Custom hook encapsulating authentication actions
 * (login, register, logout, verify) with role-based redirect.
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
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
    router.push(destination[role]);
  }

  async function checkUserAndRedirect(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    redirectByRole((profile?.role as UserRole) ?? 'client');
  }

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await checkUserAndRedirect(data.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function register({ email, password, fullName, phone }: RegisterPayload) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            full_name: fullName, 
            role: 'client',
            phone: phone || '' 
          },
        },
      });

      if (error) throw error;

      // Redirigir al login con un indicador para mostrar el input de código
      // Se pasa el email por URL para facilitar la UX
      router.push(`${ROUTES.LOGIN}?confirmed=pending&email=${encodeURIComponent(email)}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Verifica el código de 6 dígitos (OTP).
   * @param email El correo electrónico del usuario.
   * @param token El código de 6 dígitos.
   * @param type El tipo de verificación ('signup' para registro, 'recovery' para pass, etc).
   */
  async function verifyOtp(email: string, token: string, type: EmailOtpType = 'signup') {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });

      if (error) throw error;

      if (data.session?.user) {
        await checkUserAndRedirect(data.session.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push(ROUTES.HOME);
  }

  return { login, register, verifyOtp, logout, isLoading };
}