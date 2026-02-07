/**
 * @fileoverview Custom hook encapsulating authentication actions
 *               (login, OTP-based register, logout) with role-based redirect.
 * @module hooks/useAuth
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/models';

/* ── Payload types ── */

interface RequestOtpPayload {
  email: string;
}

interface VerifyOtpPayload {
  email: string;
  code: string;
}

interface CompleteRegisterPayload {
  email: string;
  fullName: string;
  password: string;
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

  /* ────────────────────────────────────────────────────────────────── */
  /*  LOGIN (unchanged)                                                */
  /* ────────────────────────────────────────────────────────────────── */

  async function login(email: string, password: string) {
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

      redirectByRole((profile?.role as UserRole) ?? 'client');
    } finally {
      setIsLoading(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  STEP 1 — Request OTP                                            */
  /* ────────────────────────────────────────────────────────────────── */

  async function requestOtp({ email }: RequestOtpPayload) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al enviar el código');
      }

      return data;
    } finally {
      setIsLoading(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  STEP 2 — Verify OTP                                             */
  /* ────────────────────────────────────────────────────────────────── */

  async function verifyOtp({ email, code }: VerifyOtpPayload) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Código inválido');
      }

      return data;
    } finally {
      setIsLoading(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  STEP 3 — Complete registration                                   */
  /* ────────────────────────────────────────────────────────────────── */

  async function completeRegister({ email, fullName, password }: CompleteRegisterPayload) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/complete-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error al completar el registro');
      }

      // Auto-login after successful registration
      await supabase.auth.signInWithPassword({ email, password });

      router.push(ROUTES.USER_DASHBOARD);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  /* ────────────────────────────────────────────────────────────────── */
  /*  LOGOUT                                                           */
  /* ────────────────────────────────────────────────────────────────── */

  async function logout() {
    await supabase.auth.signOut();
    router.push(ROUTES.HOME);
  }

  return {
    login,
    requestOtp,
    verifyOtp,
    completeRegister,
    logout,
    isLoading,
  };
}