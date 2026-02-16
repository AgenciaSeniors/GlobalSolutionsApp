import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/models";

const TRUSTED_DEVICE_KEY = "gst_trusted_device_v1";

/**
 * Devuelve true si este dispositivo ya fue "confiado" (no pedir OTP).
 * Nota: esto es por dispositivo/navegador (localStorage).
 */
function isTrustedDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TRUSTED_DEVICE_KEY) === "1";
}

function markTrustedDevice() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRUSTED_DEVICE_KEY, "1");
}

/**
 * LOGIN - PASO 1:
 * - Si ya hay sesión: no hacer nada (no pedir OTP).
 * - Si el dispositivo es confiable: login normal (password) y listo.
 * - Si es dispositivo nuevo: validar password y pedir OTP (Resend) SIN dejar sesión activa.
 */
async function signInStepOne(email: string, pass: string) {
  const supabase = createClient();

  // ✅ Si ya hay sesión, NO pedir login/OTP
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    return { success: true, message: "ALREADY_AUTHENTICATED" };
  }

  // Si este dispositivo ya se confió, hacemos login normal y listo
  if (isTrustedDevice()) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    return { success: true, message: "SIGNED_IN_TRUSTED_DEVICE" };
  }

  // Dispositivo NUEVO: validamos password y forzamos OTP
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;

  // ✅ Importante: cerramos sesión para que NO quede autenticado hasta OTP
  await supabase.auth.signOut();

  // Pedimos OTP por Resend vía endpoint
  const res = await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo enviar el código.");

  return { success: true, message: "OTP_SENT" };
}

/**
 * LOGIN - PASO 2 (solo para dispositivo nuevo):
 * Verifica OTP y devuelve sessionLink (magic link).
 * Marcamos el dispositivo como confiable para que la próxima vez NO pida OTP.
 */
async function verifyLoginOtp(email: string, code: string) {
  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo verificar el código.");

  // ✅ Al verificar OTP por primera vez, confiamos este dispositivo
  markTrustedDevice();

  return data as { ok: true; verified: true; sessionLink: string | null };
}

async function signUpStepOne(email: string, password: string, fullName: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: "client" },
    },
  });

  if (error) throw error;
  return { ok: true, message: "OTP_SENT" };
}

async function verifySignupOtp(email: string, code: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "signup",
  });

  if (error) throw error;

  // Si signup quedó autenticado en este dispositivo, lo marcamos también
  markTrustedDevice();

  return { ok: true, session: data.session };
}

async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

async function updateProfile(
  updates: Partial<Pick<Profile, "full_name" | "phone" | "avatar_url">>
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) throw error;
}

async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const authService = {
  signInStepOne,
  verifyLoginOtp,
  signUpStepOne,
  verifySignupOtp,
  getCurrentProfile,
  updateProfile,
  signOut,
};
