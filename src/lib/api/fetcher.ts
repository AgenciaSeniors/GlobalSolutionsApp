// src/lib/api/fetcher.ts  (opcional, snippet)
export async function postJSON(url: string, body: unknown, init: RequestInit = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

  if (!res.ok) {
    // Intentamos parsear respuesta JSON para extraer error descriptivo
    let parsed;
    try {
      parsed = await res.json();
    } catch {
      throw new Error(`Request failed with status ${res.status}`);
    }
    throw new Error(parsed?.error ?? `Request failed with status ${res.status}`);
  }

  // Si no devuelve JSON, esto lanzará; es deliberado para surfear errores.
  return res.json();
}
