/**
 * GET /api/flights/search/:sessionId
 *
 * C1.1: Two-phase search polling endpoint.
 * - Returns session status/results.
 * - If session is pending/refreshing, this endpoint performs the search work
 *   (with a lightweight DB lock) and persists results to session + cache.
 *
 * v2 — Fixes:
 *   1. CRITICAL: Added missing `makeRouteKeys` function (cache invalidation was broken)
 *   2. Improved cache write with error logging (silent failures were hiding issues)
 *   3. Added `Cache-Control: no-store` consistently for non-complete states
 *   4. Defensive session expiry check uses Date comparison (not string compare)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flightsOrchestrator } from "@/lib/flights/orchestrator/flightsOrchestrator";
import type { FlightLeg, FlightSearchFilters } from "@/types/api.types";

/* -------------------------------------------------- */
/* ---- CONSTANTS ----------------------------------- */
/* -------------------------------------------------- */

const CACHE_TTL_MINUTES = 15;
const FRESH_WINDOW_MS = 5 * 60 * 1000; // 5 min
const CACHE_CONTROL_RESULTS = "public, s-maxage=300, stale-while-revalidate=600";

/** If a worker hasn't sent a heartbeat in this window, consider it dead. */
const WORKER_STALE_MS = 60_000;

/* -------------------------------------------------- */
/* ---- HELPERS ------------------------------------- */
/* -------------------------------------------------- */

type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeParseDateIso(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

function extractProvidersUsed(results: ResultsByLeg): string[] {
  const set = new Set<string>();
  for (const leg of results) {
    for (const f of leg.flights) {
      const p = f.provider;
      if (typeof p === "string" && p.trim()) set.add(p.trim());
    }
  }
  return Array.from(set).sort();
}

/**
 * Builds route keys like ["MAD-BCN-2025-06-15", "BCN-MAD-2025-06-20"]
 * from the session's stored request payload.
 * Used by the DB trigger `trg_invalidate_flight_search_cache_on_seats_update`
 * to delete cache entries when `available_seats` changes on a matching route.
 */
function makeRouteKeys(request: unknown): string[] {
  if (!isRecord(request)) return [];
  const legs = request.legs;
  if (!Array.isArray(legs)) return [];

  return legs
    .filter(isRecord)
    .map((l) => {
      const o = String(l.origin ?? "").toUpperCase().trim();
      const d = String(l.destination ?? "").toUpperCase().trim();
      const dt = String(l.departure_date ?? "").trim();
      return `${o}-${d}-${dt}`;
    })
    .filter((k) => k.length > 6); // minimum "XX-XX-" = 6 chars
}

/* -------------------------------------------------- */
/* ---- SESSION TYPES ------------------------------- */
/* -------------------------------------------------- */

type SessionStatus = "pending" | "refreshing" | "running" | "complete" | "failed";

type SessionRow = {
  session_id: string;
  cache_key: string | null;
  request: unknown;
  status: SessionStatus;
  source: string | null;
  providers_used: string[] | null;
  results: unknown;
  error: string | null;
  worker_started_at: string | null;
  worker_heartbeat: string | null;
  expires_at: string;
  updated_at: string | null;
};

/* -------------------------------------------------- */
/* ---- NORMALIZERS --------------------------------- */
/* -------------------------------------------------- */

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

function normalizeRequest(
  raw: unknown
): { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters } | null {
  if (!isRecord(raw)) return null;
  const legsRaw = raw.legs;
  if (!Array.isArray(legsRaw) || legsRaw.length === 0) return null;

  const legs: FlightLeg[] = legsRaw.map((l) => ({
    origin: String(isRecord(l) ? l.origin : "").toUpperCase(),
    destination: String(isRecord(l) ? l.destination : "").toUpperCase(),
    departure_date: String(isRecord(l) ? l.departure_date : ""),
  }));

  const passengers = Number(raw.passengers ?? 1);
  const filters = isRecord(raw.filters)
    ? (raw.filters as unknown as FlightSearchFilters)
    : undefined;

  return {
    legs,
    passengers: Number.isFinite(passengers) ? passengers : 1,
    filters,
  };
}

/* -------------------------------------------------- */
/* ---- RESPONSE BUILDER ---------------------------- */
/* -------------------------------------------------- */

function buildPayload(
  session: SessionRow,
  results: ResultsByLeg
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    sessionId: session.session_id,
    status: session.status,
    source: session.source ?? "live",
    results,
    providersUsed: session.providers_used ?? extractProvidersUsed(results),
  };
  if (session.error) payload.error = session.error;
  return payload;
}

/* -------------------------------------------------- */
/* ---- HANDLER ------------------------------------- */
/* -------------------------------------------------- */

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) {
  const supabase = createAdminClient();
  const { sessionId: rawSessionId } = await ctx.params;
  const sessionId = String(rawSessionId ?? "").trim();

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId requerido." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // ── Fetch session ──────────────────────────────────
    const { data: sessionData, error: sessionErr } = await supabase
      .from("flight_search_sessions")
      .select(
        "session_id,cache_key,request,status,source,providers_used,results,error,worker_started_at,worker_heartbeat,expires_at,updated_at"
      )
      .eq("session_id", sessionId)
      .maybeSingle();

    if (sessionErr || !sessionData) {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const session = sessionData as unknown as SessionRow;

    // ── Expiry check (Date comparison, not string) ─────
    const expiresAt = safeParseDateIso(session.expires_at);
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return NextResponse.json(
        { error: "Sesión expirada." },
        { status: 410, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Already finished → return immediately ──────────
    if (session.status === "complete" || session.status === "failed") {
      const results = normalizeResults(session.results);
      const payload = buildPayload(session, results);
      const cc = session.status === "complete" ? CACHE_CONTROL_RESULTS : "no-store";
      return NextResponse.json(payload, { headers: { "Cache-Control": cc } });
    }

    // ── Attempt lightweight lock ───────────────────────
    const heartbeatStaleIso = new Date(now.getTime() - WORKER_STALE_MS).toISOString();

    const { data: lock } = await supabase
      .from("flight_search_sessions")
      .update({
        status: "running" as SessionStatus,
        worker_started_at: session.worker_started_at ?? nowIso,
        worker_heartbeat: nowIso,
        updated_at: nowIso,
      })
      .eq("session_id", sessionId)
      .in("status", ["pending", "refreshing"])
      .or(`worker_started_at.is.null,worker_heartbeat.lt.${heartbeatStaleIso}`)
      .select("session_id")
      .maybeSingle();

    if (!lock) {
      // Another worker is running — return current snapshot
      const results = normalizeResults(session.results);
      const payload = buildPayload(session, results);
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    }

    // ── We own the lock — execute search ───────────────
    const reqBody = normalizeRequest(session.request);
    if (!reqBody) {
      await supabase
        .from("flight_search_sessions")
        .update({
          status: "failed" as SessionStatus,
          error: "Sesión inválida.",
          updated_at: nowIso,
          worker_heartbeat: nowIso,
        })
        .eq("session_id", sessionId);

      return NextResponse.json(
        { sessionId, status: "failed", error: "Sesión inválida." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    try {
      const providerRes = await flightsOrchestrator.search(reqBody);
      const results: ResultsByLeg = providerRes.map((r) => ({
        legIndex: r.legIndex,
        flights: (r.flights as unknown[]).filter(isRecord) as FlightRecord[],
      }));

      const providersUsed = extractProvidersUsed(results);
      const routeKeys = makeRouteKeys(session.request);
      const completedAt = new Date().toISOString();

      // ── Cache write ────────────────────────────────
      if (session.cache_key) {
        const cacheExpires = new Date(
          Date.now() + CACHE_TTL_MINUTES * 60 * 1000
        ).toISOString();
        const freshUntil = new Date(
          Date.now() + FRESH_WINDOW_MS
        ).toISOString();

        const { error: cacheErr } = await supabase
          .from("flight_search_cache")
          .upsert(
            {
              cache_key: session.cache_key,
              response: results,
              created_at: completedAt,
              fresh_until: freshUntil,
              expires_at: cacheExpires,
              route_keys: routeKeys,
            },
            { onConflict: "cache_key" }
          );

        if (cacheErr) {
          console.warn(
            `[FLIGHT_SEARCH] Cache write failed for key=${session.cache_key}: ${cacheErr.message}`
          );
          // Non-fatal: search still returns results even if cache write fails
        }
      }

      // ── Session update → complete ──────────────────
      await supabase
        .from("flight_search_sessions")
        .update({
          status: "complete" as SessionStatus,
          source: "live",
          providers_used: providersUsed,
          results,
          error: null,
          updated_at: completedAt,
          worker_heartbeat: completedAt,
        })
        .eq("session_id", sessionId);

      return NextResponse.json(
        {
          sessionId,
          status: "complete",
          source: "live",
          providersUsed,
          results,
        },
        { headers: { "Cache-Control": CACHE_CONTROL_RESULTS } }
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : String(e ?? "Error buscando vuelos");
      const failedAt = new Date().toISOString();

      // Mark failed, but preserve any existing results (stale cache)
      await supabase
        .from("flight_search_sessions")
        .update({
          status: "failed" as SessionStatus,
          error: msg,
          updated_at: failedAt,
          worker_heartbeat: failedAt,
        })
        .eq("session_id", sessionId);

      return NextResponse.json(
        {
          sessionId,
          status: "failed",
          source: session.source ?? "live",
          results: normalizeResults(session.results),
          providersUsed: session.providers_used ?? [],
          error: msg,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (err: unknown) {
    console.error("[FLIGHT_SEARCH_SESSION_ERROR]", err);
    const msg =
      err instanceof Error ? err.message : String(err ?? "Internal server error");
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
