/**
 * @fileoverview Custom hook encapsulating authentication actions
 *               (login, hybrid register, logout) with role-based redirect.
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

interface RegisterOtpRequestPayload {
  email: string;
  fullName: string;
  role?: UserRole; // default client
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

  async function fetchRoleAndRedirect(userId: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      // fallback to client dashboard
      redirectByRole('client');
      return;
    }
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
      await fetchRoleAndRedirect(data.user.id);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Hybrid auth: Step 1 — send OTP (6 digits) to email.
   * If the user doesn't exist, Supabase will create it (shouldCreateUser=true).
   */
  async function requestRegisterOtp({ email, fullName, role = 'client' }: RegisterOtpRequestPayload) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: fullName, role },
        },
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Hybrid auth: Step 2 — verify OTP. On success, a session is created.
   * Returns the user id to allow subsequent steps.
   */
  async function verifyRegisterOtp(email: string, code6: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code6,
        type: 'email',
      });
      if (error) throw error;
      if (!data.user) throw new Error('No se pudo verificar el código.');
      return data.user.id;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Hybrid auth: Step 3 — set password after OTP verification.
   * Keeps the current session.
   */
  async function setPassword(password: string) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (data.user) await fetchRoleAndRedirect(data.user.id);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push(ROUTES.HOME);
  }

  return {
    login,
    requestRegisterOtp,
    verifyRegisterOtp,
    setPassword,
    logout,
    isLoading,
  };
}
