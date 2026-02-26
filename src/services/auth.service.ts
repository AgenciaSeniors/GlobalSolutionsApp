// src/services/auth.service.ts
import { createClient } from "@/lib/supabase/client";
import { Capacitor } from "@capacitor/core";
import type { Profile } from "@/types/models";

// 🔧 FIX: Prefix incluye email hash para que trusted sea por usuario+dispositivo
const TRUSTED_DEVICE_PREFIX = "gst_trusted_v2_";

/**
 * Genera una clave de localStorage única por email (dispositivo + usuario).
 * Usa un hash simple para no guardar el email en claro.
 */
function trustedKey(email: string): string {
  let hash = 0;
  const normalized = email.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `${TRUSTED_DEVICE_PREFIX}${Math.abs(hash).toString(36)}`;
}

function isTrustedDevice(email: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(trustedKey(email)) === "1";
}

function markTrustedDevice(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(trustedKey(email), "1");
}

/**
 * LOGIN - PASO 1
 */
async function signInStepOne(email: string, pass: string) {
  const supabase = createClient();
  const normalizedEmail = email.trim().toLowerCase();

  // ✅ Si ya hay sesión, NO pedir login/OTP
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    return { success: true, message: "ALREADY_AUTHENTICATED" };
  }

  // 🔧 Si este dispositivo ya se confió para ESTE email, login directo
  if (isTrustedDevice(normalizedEmail)) {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });
    if (error) throw new Error(error.message);
    return { success: true, message: "SIGNED_IN_TRUSTED_DEVICE" };
  }

  // 🔧 Dispositivo NUEVO — validar credenciales SERVER-SIDE sin crear sesión en el browser
  const validateRes = await fetch("/api/auth/validate-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, password: pass }),
  });

  const validateData = await validateRes.json().catch(() => ({}));
  if (!validateRes.ok) {
    throw new Error(validateData?.error ?? "Credenciales inválidas.");
  }

  // Pedir OTP por Resend — NO hay sesión activa en el browser
  const otpRes = await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const otpData = await otpRes.json().catch(() => ({}));
  if (!otpRes.ok) throw new Error(otpData?.error ?? "No se pudo enviar el código.");

  return { success: true, message: "OTP_SENT" };
}

/**
 * LOGIN - PASO 2 (solo para dispositivo nuevo):
 * Verifica OTP → en app nativa usa setSession con tokens directos.
 * En web navega al sessionLink (magic link) como antes.
 */
async function verifyLoginOtp(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const isNative = Capacitor.isNativePlatform();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isNative) {
    // Indicar al servidor que estamos en app nativa para recibir tokens directos
    headers["X-App-Platform"] = "android";
  }

  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: normalizedEmail, code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "No se pudo verificar el código.");

  // ✅ Marcar dispositivo como confiable para ESTE email
  markTrustedDevice(normalizedEmail);

  // En app nativa: setSession directamente con los tokens (no hay navegación a supabase.co)
  if (isNative && data.access_token && data.refresh_token) {
    const supabase = createClient();
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionErr) throw new Error(sessionErr.message);
    return { ok: true, verified: true } as const;
  }

  // En web: retornar sessionLink para navegación
  if (!data.sessionLink) {
    throw new Error("No se pudo generar el enlace de sesión. Intenta de nuevo.");
  }

  return data as { ok: true; verified: true; sessionLink: string };
}

/**
 * SIGNUP - PASO 1:
 * Enviar OTP por Resend (NO Supabase signUp).
 */
async function signUpStepOne(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const otpRes = await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, mode: "register" }),
  });

  const otpData = await otpRes.json().catch(() => ({}));
  if (!otpRes.ok) throw new Error(otpData?.error ?? "No se pudo enviar el código.");

  return { ok: true, message: "OTP_SENT" };
}

/**
 * SIGNUP - PASO 2:
 * Verifica OTP (modo register) -> crea usuario -> inicia sesión.
 */
async function verifySignupOtp(email: string, code: string, fullName: string, password: string) {
  const supabase = createClient();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName?.trim() ?? "";

  if (!normalizedName) throw new Error("Nombre completo es requerido.");
  if (!password) throw new Error("Contraseña es requerida.");

  // 1) Verificar OTP en modo register (NO genera sessionLink)
  const vRes = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, code, mode: "register" }),
  });

  const vData = await vRes.json().catch(() => ({}));
  if (!vRes.ok) throw new Error(vData?.error ?? "Código inválido.");

  // 2) Crear usuario (server) usando tu endpoint
  // Debe setear email_confirm: true en admin.createUser (según tu implementación)
  const cRes = await fetch("/api/auth/complete-register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: normalizedEmail,
      fullName: normalizedName,
      password,
    }),
  });

  const cData = await cRes.json().catch(() => ({}));
  if (!cRes.ok) throw new Error(cData?.error ?? "No se pudo crear la cuenta.");

  // 3) Iniciar sesión con password (ya debe poder porque el user quedó confirmado)
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (signInErr) {
    // Mensaje más útil por si el user ya existía o no quedó confirmado
    throw new Error(signInErr.message || "No se pudo iniciar sesión.");
  }

  // 4) Confiar este dispositivo para este email
  markTrustedDevice(normalizedEmail);

  return { ok: true };
}

async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

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

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
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
