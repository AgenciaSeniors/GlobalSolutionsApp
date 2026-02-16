/**
 * @fileoverview Auth service for server-side authentication operations.
 * @module services/auth.service
 */
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/models';

/**
 * PASO 1: Iniciar sesión con credenciales.
 * Valida la contraseña y dispara el envío del OTP.
 */
async function signInStepOne(email: string, pass: string) {
  const supabase = createClient();
  
  // 1. Validamos email y contraseña
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) throw error;

  // 2. Si las credenciales son válidas, disparamos el envío del OTP 
  const response = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error('Error al enviar el código de seguridad');
  }

  // Por seguridad, cerramos la sesión temporal. 
  await supabase.auth.signOut();

  return { success: true, message: 'OTP_SENT' };
}

/**
 * PASO 2: Verificar el código de 6 dígitos.
 */
async function verifyLoginOtp(email: string, code: string) {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Código inválido');

  return result;
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
 * CERRAR SESIÓN (Agregado para el Sidebar)
 */
async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Exportamos todas las funciones juntas
export const authService = { 
  signInStepOne, 
  verifyLoginOtp, 
  getCurrentProfile, 
  updateProfile,
  signOut // <-- Incluida en el export
};