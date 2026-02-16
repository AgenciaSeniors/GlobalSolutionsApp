/**
 * @fileoverview Auth service for client-side authentication operations.
 * @module services/auth.service
 */
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/models';

/**
 * LOGIN - PASO 1:
 * Validar contraseña (opcional) y enviar OTP por email usando Supabase.
 * Esto asegura que en un dispositivo nuevo siempre pida código.
 */
async function signInStepOne(email: string, pass: string) {
  const supabase = createClient();

  // 1) Validamos email + password (si tú quieres 2 pasos)
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;

  // 2) Cerramos la sesión temporal (no queremos sesión hasta OTP)
  await supabase.auth.signOut();

  // 3) Enviamos OTP por email (Supabase)
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // login: no crear usuario
    },
  });

  if (otpErr) throw otpErr;

  return { success: true, message: 'OTP_SENT' };
}

/**
 * LOGIN - PASO 2:
 * Verificar el código de 6 dígitos que llega por EMAIL y crear sesión.
 */
async function verifyLoginOtp(email: string, code: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });

  if (error) throw error;

  return { ok: true, session: data.session };
}

/**
 * SIGNUP - PASO 1:
 * Crear usuario (manda confirmación por email si tienes "Confirm email" activo).
 */
async function signUpStepOne(email: string, password: string, fullName: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: 'client' },
    },
  });

  if (error) throw error;

  return { ok: true, message: 'OTP_SENT' };
}

/**
 * SIGNUP - PASO 2:
 * Verificar OTP de signup (código del email) y crear sesión.
 */
async function verifySignupOtp(email: string, code: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'signup',
  });

  if (error) throw error;

  return { ok: true, session: data.session };
}

/**
 * Obtener el perfil del usuario actual.
 */
async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data as Profile | null;
}

/**
 * Actualizar datos del perfil.
 */
async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) throw error;
}

/**
 * Cerrar sesión
 */
async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const authService = {
  // login (password + OTP)
  signInStepOne,
  verifyLoginOtp,

  // signup (confirmación por OTP)
  signUpStepOne,
  verifySignupOtp,

  // profile
  getCurrentProfile,
  updateProfile,

  // logout
  signOut,
};
