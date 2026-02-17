/**
 * GET /api/flights/search/:sessionId
 *
 * C1.1: Two-phase search polling endpoint.
 *
 * v3 — CRITICAL FIX: Background worker pattern.
 *
 * PROBLEM (v2):
 *   The first poll that acquired the "lock" blocked its HTTP response for
 *   ~30-40s while the orchestrator called the SkyScrapper API. Meanwhile,
 *   all subsequent polls returned {status: "running", results: null} because
 *   they couldn't acquire the lock. The client hook timed out (45s) before
 *   the first poll's response ever arrived, resulting in infinite polling.
 *
 * FIX:
 *   When a poll acquires the lock, it starts the orchestrator in background
 *   (fire-and-forget) and responds IMMEDIATELY with {status: "running"}.
 *   The background worker updates the DB to "complete" or "failed" when done.
 *   Subsequent polls simply read the current session state from the DB.
 *   Eventually one poll sees status="complete" and returns the results.
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
    .filter((k) => k.length > 6);
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
/* ---- BACKGROUND WORKER --------------------------- */
/* -------------------------------------------------- */

/**
 * Executes the flight search in background and updates the session in DB.
 * This function is called fire-and-forget — it never blocks an HTTP response.
 */
async function executeSearchWorker(
  sessionId: string,
  session: SessionRow
): Promise<void> {
  const supabase = createAdminClient();

  const reqBody = normalizeRequest(session.request);
  if (!reqBody) {
    await supabase
      .from("flight_search_sessions")
      .update({
        status: "failed" as SessionStatus,
        error: "Sesión inválida: request malformado.",
        updated_at: new Date().toISOString(),
        worker_heartbeat: new Date().toISOString(),
      })
      .eq("session_id", sessionId);
    return;
  }

  try {
    console.log(`[WORKER:${sessionId.slice(0, 8)}] Starting orchestrator search...`);
    const providerRes = await flightsOrchestrator.search(reqBody);
    const results: ResultsByLeg = providerRes.map((r) => ({
      legIndex: r.legIndex,
      flights: (r.flights as unknown[]).filter(isRecord) as FlightRecord[],
    }));

    const providersUsed = extractProvidersUsed(results);
    const routeKeys = makeRouteKeys(session.request);
    const completedAt = new Date().toISOString();
    const totalFlights = results.reduce((s, r) => s + r.flights.length, 0);

    console.log(
      `[WORKER:${sessionId.slice(0, 8)}] Search complete: ${totalFlights} flights from [${providersUsed.join(", ")}]`
    );

    // ── Cache write ──
    if (session.cache_key) {
      const cacheExpires = new Date(
        Date.now() + CACHE_TTL_MINUTES * 60 * 1000
      ).toISOString();
      const freshUntil = new Date(Date.now() + FRESH_WINDOW_MS).toISOString();

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
          `[WORKER:${sessionId.slice(0, 8)}] Cache write failed: ${cacheErr.message}`
        );
      }
    }

    // ── Session update → complete ──
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

    console.log(`[WORKER:${sessionId.slice(0, 8)}] Session marked complete.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "Error buscando vuelos");
    const failedAt = new Date().toISOString();

    console.error(`[WORKER:${sessionId.slice(0, 8)}] Search failed: ${msg}`);

    await supabase
      .from("flight_search_sessions")
      .update({
        status: "failed" as SessionStatus,
        error: msg,
        updated_at: failedAt,
        worker_heartbeat: failedAt,
      })
      .eq("session_id", sessionId);
  }
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

    // ── Expiry check ─────────────────────────────────
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

    // ── Attempt lightweight lock via RPC ────────────────
    // Using an RPC instead of .in().or() chain because PostgREST
    // silently fails to combine these filters correctly.
    const heartbeatStaleIso = new Date(now.getTime() - WORKER_STALE_MS).toISOString();

    const { data: lockAcquired } = await supabase.rpc("try_lock_search_session", {
      p_session_id: sessionId,
      p_now: nowIso,
      p_stale_threshold: heartbeatStaleIso,
    });

    if (lockAcquired === true) {
      // ── We own the lock — start worker in BACKGROUND ──
      // Fire-and-forget: do NOT await. The worker updates the DB when done.
      // Subsequent polls will see status="complete" once the worker finishes.
      void executeSearchWorker(sessionId, session);

      console.log(
        `[POLL:${sessionId.slice(0, 8)}] Lock acquired, worker started in background.`
      );
    }

    // ── Always respond immediately with current state ──
    // Whether we just started the worker or another worker is already running,
    // we return the current session snapshot. Client polls again in 1.5s.
    const results = normalizeResults(session.results);
    const payload = buildPayload(
      { ...session, status: "running" },
      results
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
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