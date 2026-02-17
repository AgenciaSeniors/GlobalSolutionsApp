//src\app\api\flights\search\route.ts
/**
 * POST /api/flights/search
 *
 * C1.1: Phase 1 — start a search session (or return cached results immediately).
 *
 * - If cache is fresh: returns { status:"complete", results, providersUsed } (no sessionId)
 * - Otherwise: creates a session and returns { sessionId, status:"pending"/"refreshing", results?: stale }
 *
 * Phase 2 polling lives in:
 *   src/app/api/flights/search/[sessionId]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* -------------------------------------------------- */
/* ---- CONSTANTS ----------------------------------- */
/* -------------------------------------------------- */

const CACHE_TTL_MINUTES = 15;
const CACHE_CONTROL_RESULTS = "public, s-maxage=300, stale-while-revalidate=600";

/* -------------------------------------------------- */
/* ---- TYPES & HELPERS ----------------------------- */
/* -------------------------------------------------- */

type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;

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

  const now = new Date();
  const nowIso = now.toISOString();
  const cacheKey = stableStringify(body);

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
    const results = normalizeResults(cacheRow?.response);
    return NextResponse.json(
      {
        status: "complete",
        source: "cache",
        results,
        providersUsed: extractProvidersUsed(results),
      },
      { headers: { "Cache-Control": CACHE_CONTROL_RESULTS } }
    );
  }

  // ── Create session ─────────────────────────────────
  const sessionExpiresAt = new Date(
    now.getTime() + CACHE_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const staleResults = cacheNotExpired ? normalizeResults(cacheRow?.response) : [];
  const status = staleResults.length ? "refreshing" : "pending";

  const { data: session, error: insertErr } = await supabase
    .from("flight_search_sessions")
    .insert({
      cache_key: cacheKey,
      request: body,
      status,
      source: staleResults.length ? "cache" : "live",
      providers_used: staleResults.length ? extractProvidersUsed(staleResults) : null,
      results: staleResults.length ? staleResults : null,
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
      results: staleResults,
      providersUsed: session.providers_used ?? extractProvidersUsed(staleResults),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
