//src/app/api/flights/search/route.ts
/**
 * POST /api/flights/search
 *
 * C1.1: Phase 1 — start a search session (or return cached results immediately).
 *
 * - If cache is fresh: returns { status:"complete", results, providersUsed } (no sessionId)
 * - Otherwise: creates a session and returns { sessionId, status:"pending"/"refreshing", results?: stale }
 *
 * Phase 2 polling lives in:
 * src/app/api/flights/search/[sessionId]/route.ts
 */

import { getRoleAndMarkupPct, applyRoleMarkup } from "@/lib/flights/roleMarkup";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* -------------------------------------------------- */
/* ---- CONSTANTS ----------------------------------- */
/* -------------------------------------------------- */

const CACHE_TTL_MINUTES = 3;

// Rate limiting — permisivo para humanos, bloquea bots
// Un humano difícilmente hace más de 200 búsquedas en 10 minutos
const RATE_LIMIT_MAX = 200;        // max búsquedas por ventana
const RATE_LIMIT_WINDOW_MS = 600_000; // ventana de 10 minutos

/* -------------------------------------------------- */
/* ---- TYPES & HELPERS ----------------------------- */
/* -------------------------------------------------- */


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeResults(raw: unknown): ResultsByLeg {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((r) => ({
      legIndex: Number((r as FlightRecord).legIndex ?? 0),
      flights: Array.isArray((r as FlightRecord).flights)
        ? (((r as FlightRecord).flights as unknown[]).filter(isRecord) as FlightRecord[])
        : [],
    }));
}

function extractProvidersUsed(results: ResultsByLeg): string[] {
  const set = new Set<string>();
  for (const leg of results) {
    for (const f of leg.flights) {
      const p = (f as FlightRecord).provider;
      if (typeof p === "string" && p.trim()) set.add(p.trim());
    }
  }
  return Array.from(set).sort();
}

function safeParseDateIso(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

// Stable stringify so cache_key doesn't depend on key order
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);

  const keys = Object.keys(value).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",");
  return `{${body}}`;
}

type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;


/* -------------------------------------------------- */
/* ---- HANDLER ------------------------------------- */
/* -------------------------------------------------- */

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Minimal validation: must include legs
  if (!isRecord(body) || !Array.isArray(body.legs) || body.legs.length === 0) {
    return NextResponse.json(
      { error: "Request inválido: legs es requerido." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // --- Aseguramos que la clase viaje en el request para que se guarde en la sesión ---
  const validBody = {
    ...body as Record<string, unknown>,
    cabinClass: isRecord(body) && typeof body.cabinClass === 'string' ? body.cabinClass : 'economy'
  };

  const now = new Date();
  const nowIso = now.toISOString();

  // ── Rate limiting ───────────────────────────────────
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { data: rateRow } = await supabase
    .from("search_rate_limits")
    .select("ip_address,last_search_at,search_count")
    .eq("ip_address", clientIp)
    .maybeSingle();

  const lastSearchAt = safeParseDateIso(rateRow?.last_search_at);
  const withinWindow =
    !!lastSearchAt && now.getTime() - lastSearchAt.getTime() < RATE_LIMIT_WINDOW_MS;

  if (withinWindow && (rateRow?.search_count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas. Intenta de nuevo en unos minutos." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "600",
        },
      }
    );
  }

  // Upsert rate limit counter (reset if outside window)
  await supabase.from("search_rate_limits").upsert(
    {
      ip_address: clientIp,
      last_search_at: nowIso,
      search_count: withinWindow ? (rateRow?.search_count ?? 0) + 1 : 1,
    },
    { onConflict: "ip_address" }
  );

  const cacheKey = stableStringify(validBody);
  const { markupPct } = await getRoleAndMarkupPct(supabase);

  // ── Cache lookup ──────────────────────────────────
  const { data: cacheRow } = await supabase
    .from("flight_search_cache")
    .select("cache_key,response,fresh_until,expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  const expiresAt = safeParseDateIso(cacheRow?.expires_at);
  const freshUntil = safeParseDateIso(cacheRow?.fresh_until);

  const cacheNotExpired = !!expiresAt && expiresAt.getTime() > now.getTime();

  if (cacheNotExpired && freshUntil && freshUntil.getTime() > now.getTime()) {
   const resultsRaw = normalizeResults(cacheRow?.response);
const results = applyRoleMarkup(resultsRaw, markupPct);

return NextResponse.json(
  {
    status: "complete",
    source: "cache",
    results,
    providersUsed: extractProvidersUsed(resultsRaw),
  },
  { headers: { "Cache-Control": "no-store" } }
);
  }

  // ── Create session ─────────────────────────────────
  const sessionExpiresAt = new Date(
    now.getTime() + CACHE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const staleResultsRaw = cacheNotExpired ? normalizeResults(cacheRow?.response) : [];
const staleResults = applyRoleMarkup(staleResultsRaw, markupPct);
  const status = staleResults.length ? "refreshing" : "pending";

  const { data: session, error: insertErr } = await supabase
    .from("flight_search_sessions")
    .insert({
      cache_key: cacheKey,
      request: validBody, // <--- AQUÍ ESTABA EL ERROR: Cambiado de 'body' a 'validBody'
      status,
      source: staleResults.length ? "cache" : "live",
      providers_used: staleResultsRaw.length ? extractProvidersUsed(staleResultsRaw) : null,
      results: staleResultsRaw.length ? staleResultsRaw : null,
      error: null,
      worker_started_at: null,
      worker_heartbeat: null,
      expires_at: sessionExpiresAt,
      updated_at: nowIso,
    })
    .select("session_id,status,source,results,providers_used")
    .single();

  if (insertErr || !session) {
    return NextResponse.json(
      { error: insertErr?.message ?? "No se pudo crear sesión." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      sessionId: session.session_id,
      status: session.status,
      source: session.source ?? (staleResults.length ? "cache" : "live"),
      // ✅ No mostrar resultados cuando es una búsqueda nueva (pending).
      // Si hay caché previo, permitimos mostrarlo como "refreshing".
      results: status === "refreshing" ? staleResults : [],
      providersUsed: session.providers_used ?? extractProvidersUsed(staleResultsRaw),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}