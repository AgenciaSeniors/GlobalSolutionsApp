export async function requestOtp(email: string) {
  const res = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo enviar el código.');
  return data as { ok: true; verified?: boolean; sessionLink?: string | null };
}

export async function verifyOtp(email: string, code: string) {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo verificar el código.');
  return data as { ok: true; verified?: boolean; sessionLink?: string | null };
}

export async function completeRegister(email: string, fullName: string, password: string) {
  const res = await fetch('/api/auth/complete-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? 'No se pudo completar el registro.');
  return data as { ok: true; userId?: string };
}
