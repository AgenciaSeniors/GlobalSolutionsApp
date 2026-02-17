/**
 * GET /api/flights/search/:sessionId
 *
 * C1.1: Two-phase search polling endpoint.
 * - Returns session status/results.
 * - If session is pending/refreshing, this endpoint performs the search work
 *   (with a lightweight DB lock) and persists results to session + cache.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flightsOrchestrator } from "@/lib/flights/orchestrator/flightsOrchestrator";
import type { FlightLeg, FlightSearchFilters } from "@/types/api.types";

const CACHE_TTL_MINUTES = 15;
const CACHE_CONTROL_RESULTS = "public, s-maxage=300, stale-while-revalidate=600";

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

type SessionRow = {
  session_id: string;
  cache_key: string | null;
  request: unknown;
  status: "pending" | "refreshing" | "running" | "complete" | "failed";
  source: string | null;
  providers_used: string[] | null;
  results: unknown;
  error: string | null;
  worker_started_at: string | null;
  worker_heartbeat: string | null;
  expires_at: string;
  updated_at: string | null;
};

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

function normalizeRequest(raw: unknown): { legs: FlightLeg[]; passengers: number; filters?: FlightSearchFilters } | null {
  if (!isRecord(raw)) return null;
  const legsRaw = raw.legs;
  if (!Array.isArray(legsRaw) || legsRaw.length === 0) return null;

  const legs: FlightLeg[] = legsRaw.map((l) => ({
    origin: String(isRecord(l) ? l.origin : "").toUpperCase(),
    destination: String(isRecord(l) ? l.destination : "").toUpperCase(),
    departure_date: String(isRecord(l) ? l.departure_date : ""),
  }));

  const passengers = Number(raw.passengers ?? 1);
  const filters = isRecord(raw.filters) ? (raw.filters as unknown as FlightSearchFilters) : undefined;
  return { legs, passengers: Number.isFinite(passengers) ? passengers : 1, filters };
}

export async function GET(_req: Request, ctx: { params: { sessionId: string } }) {
  const supabase = createAdminClient();
  const sessionId = String(ctx.params.sessionId ?? "").trim();

  try {
    const nowIso = new Date().toISOString();

    const { data: sessionData, error: sessionErr } = await supabase
      .from("flight_search_sessions")
      .select(
        "session_id,cache_key,request,status,source,providers_used,results,error,worker_started_at,worker_heartbeat,expires_at,updated_at"
      )
      .eq("session_id", sessionId)
      .maybeSingle();

    if (sessionErr || !sessionData) {
      const res = NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const session = sessionData as unknown as SessionRow;
    const expiresAt = safeParseDateIso(session.expires_at);
    if (expiresAt && expiresAt.toISOString() <= nowIso) {
      const res = NextResponse.json({ error: "Sesión expirada." }, { status: 410 });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // If already finished, return immediately
    if (session.status === "complete" || session.status === "failed") {
      const results = normalizeResults(session.results);
      const payload: Record<string, unknown> = {
        sessionId: session.session_id,
        status: session.status,
        source: session.source ?? "live",
        results,
        providersUsed: session.providers_used ?? extractProvidersUsed(results),
      };
      if (session.error) payload.error = session.error;
      const res = NextResponse.json(payload);
      res.headers.set(
        "Cache-Control",
        session.status === "complete" ? CACHE_CONTROL_RESULTS : "no-store"
      );
      return res;
    }

    // Attempt to acquire a lightweight lock so only one poller performs work.
    const heartbeatStaleIso = new Date(Date.now() - 60_000).toISOString();
    const { data: lock } = await supabase
      .from("flight_search_sessions")
      .update({
        status: "running",
        worker_started_at: session.worker_started_at ?? nowIso,
        worker_heartbeat: nowIso,
        updated_at: nowIso,
      })
      .eq("session_id", sessionId)
      .in("status", ["pending", "refreshing"]) // only claim if not already running
      .or(`worker_started_at.is.null,worker_heartbeat.lt.${heartbeatStaleIso}`)
      .select("session_id")
      .maybeSingle();

    if (!lock) {
      // Someone else is working. Return current snapshot.
      const results = normalizeResults(session.results);
      const payload: Record<string, unknown> = {
        sessionId: session.session_id,
        status: session.status,
        source: session.source ?? "live",
        results,
        providersUsed: session.providers_used ?? extractProvidersUsed(results),
      };
      if (session.error) payload.error = session.error;
      const res = NextResponse.json(payload);
      res.headers.set(
        "Cache-Control",
        session.status === "complete" ? CACHE_CONTROL_RESULTS : "no-store"
      );
      return res;
    }

    // We own the lock: execute search
    const reqBody = normalizeRequest(session.request);
    if (!reqBody) {
      await supabase
        .from("flight_search_sessions")
        .update({ status: "failed", error: "Sesión inválida.", updated_at: nowIso, worker_heartbeat: nowIso })
        .eq("session_id", sessionId);

      const res = NextResponse.json({ sessionId, status: "failed", error: "Sesión inválida." }, { status: 400 });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    try {
      const providerRes = await flightsOrchestrator.search(reqBody);
      const results: ResultsByLeg = providerRes.map((r) => ({
        legIndex: r.legIndex,
        flights: (r.flights as unknown[]).filter(isRecord) as FlightRecord[],
      }));

      const providersUsed = extractProvidersUsed(results);

      // Cache write
      if (session.cache_key) {
        const cacheExpires = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
        await supabase
          .from("flight_search_cache")
          .upsert(
            {
              cache_key: session.cache_key,
              response: results,
              created_at: nowIso,
              fresh_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              expires_at: cacheExpires,
              route_keys: makeRouteKeys(session.request),
            },
            { onConflict: "cache_key" }
          );
      }

      await supabase
        .from("flight_search_sessions")
        .update({
          status: "complete",
          source: "live",
          providers_used: providersUsed,
          results,
          error: null,
          updated_at: new Date().toISOString(),
          worker_heartbeat: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      const res = NextResponse.json({
        sessionId,
        status: "complete",
        source: "live",
        providersUsed,
        results,
      });
      res.headers.set("Cache-Control", CACHE_CONTROL_RESULTS);
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e ?? "Error buscando vuelos");

      // Mark failed, but preserve any existing results (stale cache)
      await supabase
        .from("flight_search_sessions")
        .update({
          status: "failed",
          error: msg,
          updated_at: new Date().toISOString(),
          worker_heartbeat: new Date().toISOString(),
        })
        .eq("session_id", sessionId);

      const res = NextResponse.json({
        sessionId,
        status: "failed",
        source: session.source ?? "live",
        results: normalizeResults(session.results),
        providersUsed: session.providers_used ?? [],
        error: msg,
      });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
  } catch (err: unknown) {
    console.error("[FLIGHT_SEARCH_SESSION_ERROR]", err);
    const msg = err instanceof Error ? err.message : String(err ?? "Internal server error");
    const res = NextResponse.json({ error: msg }, { status: 500 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}
