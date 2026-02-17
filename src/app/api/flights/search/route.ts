/**
 * POST /api/flights/search
 *
 * C1.1: Two-phase search
 * - POST creates a server-side session and returns { sessionId, status, results? }
 * - Client polls GET /api/flights/search/:sessionId for completion.
 *
 * Stale-while-revalidate:
 * - If cache is fresh (<= 5 min): return session already complete with cached results.
 * - If cache is stale but valid (<= 15 min): return session "refreshing" with cached results.
 * - Otherwise: return session "pending".
 *
 * v2 — Fixes:
 *   1. HMAC secret no longer falls back to SUPABASE_SERVICE_ROLE_KEY (C0.3 compliance)
 *   2. Added `makeRouteKeys` consistency with polling endpoint
 *   3. Improved validation error messages
 *   4. Tighter type guards
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FlightLeg,
  FlightSearchFilters,
  FlightSearchParams,
} from "@/types/api.types";

/* -------------------------------------------------- */
/* ---- CONSTANTS ----------------------------------- */
/* -------------------------------------------------- */

const CACHE_TTL_MINUTES = 15;
const FRESH_MS = 5 * 60 * 1000;
const SESSION_TTL_MINUTES = 20;

const RATE_LIMIT_WINDOW_MS = 30_000;
const RATE_LIMIT_ANON = 5;
const RATE_LIMIT_AUTH = 10;

/* -------------------------------------------------- */
/* ---- TYPES --------------------------------------- */
/* -------------------------------------------------- */

type FlightRecord = Record<string, unknown>;
type ResultsByLeg = Array<{ legIndex: number; flights: FlightRecord[] }>;

/* -------------------------------------------------- */
/* ---- GUARDS -------------------------------------- */
/* -------------------------------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidIATA(x: string): boolean {
  return /^[A-Z]{3}$/.test(x);
}

function isValidDateYYYYMMDD(x: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function isValidHHMM(x: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
}

/* -------------------------------------------------- */
/* ---- CLIENT IDENTIFICATION ----------------------- */
/* -------------------------------------------------- */

function getClientIp(req: Request): string {
  const candidates = [
    req.headers.get("x-real-ip"),
    req.headers.get("x-vercel-forwarded-for"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-forwarded-for"),
  ].filter(Boolean) as string[];

  const raw = candidates[0] ?? "";
  if (!raw) return "0.0.0.0";
  return raw.split(",")[0]?.trim() || "0.0.0.0";
}

/**
 * C1.3: HMAC fingerprint for anonymous rate limiting.
 * Uses dedicated RATE_LIMIT_HMAC_SECRET — never falls back to service_role key.
 */
function makeRateLimitKey(ip: string, userAgent: string): string {
  const secret = process.env.RATE_LIMIT_HMAC_SECRET;
  if (!secret) {
    // Fallback: deterministic but weaker — log warning in dev
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[RATE_LIMIT] RATE_LIMIT_HMAC_SECRET not set — using IP-only fingerprint"
      );
    }
    // Hash IP+UA with a static salt (not ideal but never uses service_role)
    const hash = crypto
      .createHash("sha256")
      .update(`rate-limit-salt:${ip}|${userAgent}`)
      .digest("hex")
      .slice(0, 40);
    return `anon:${hash}`;
  }

  const fp = crypto
    .createHmac("sha256", secret)
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 40);
  return `anon:${fp}`;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------- */
/* ---- NORMALIZATION ------------------------------- */
/* -------------------------------------------------- */

function normalizeFilters(
  raw: unknown
): FlightSearchFilters | undefined {
  if (!raw || !isRecord(raw)) return undefined;

  const airlineCodes =
    Array.isArray(raw.airlineCodes) && raw.airlineCodes.length
      ? raw.airlineCodes.map((c) => String(c).toUpperCase()).sort()
      : undefined;

  const minPrice =
    raw.minPrice != null ? Number(raw.minPrice) : undefined;
  const maxPrice =
    raw.maxPrice != null ? Number(raw.maxPrice) : undefined;

  const departureTimeRange =
    isRecord(raw.departureTimeRange) &&
    raw.departureTimeRange.from &&
    raw.departureTimeRange.to
      ? {
          from: String(raw.departureTimeRange.from),
          to: String(raw.departureTimeRange.to),
        }
      : undefined;

  const maxStops =
    raw.maxStops != null ? Number(raw.maxStops) : undefined;

  const cleaned: FlightSearchFilters = {};
  if (airlineCodes?.length) cleaned.airlineCodes = airlineCodes;
  if (Number.isFinite(minPrice as number)) cleaned.minPrice = minPrice;
  if (Number.isFinite(maxPrice as number)) cleaned.maxPrice = maxPrice;
  if (departureTimeRange?.from && departureTimeRange?.to)
    cleaned.departureTimeRange = departureTimeRange;
  if (Number.isFinite(maxStops as number)) cleaned.maxStops = maxStops;

  return Object.keys(cleaned).length ? cleaned : undefined;
}

function normalizeToRequest(params: FlightSearchParams): {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
} {
  const anyParams: unknown = params;
  const filters = normalizeFilters(
    isRecord(anyParams) ? anyParams.filters : undefined
  );

  // New format: { legs, passengers, filters }
  if (
    "legs" in params &&
    Array.isArray(params.legs) &&
    params.legs.length > 0
  ) {
    const legs = params.legs.map((l) => ({
      origin: String(l.origin).toUpperCase(),
      destination: String(l.destination).toUpperCase(),
      departure_date: String(l.departure_date),
    }));

    return { legs, passengers: Number(params.passengers ?? 1), filters };
  }

  // Legacy format
  const origin = isRecord(anyParams)
    ? String(anyParams.origin ?? "").toUpperCase()
    : "";
  const destination = isRecord(anyParams)
    ? String(anyParams.destination ?? "").toUpperCase()
    : "";
  const departure_date = isRecord(anyParams)
    ? String(anyParams.departure_date ?? "")
    : "";
  const passengers = isRecord(anyParams)
    ? Number(anyParams.passengers ?? 1)
    : 1;

  const legs: FlightLeg[] = [{ origin, destination, departure_date }];

  if (isRecord(anyParams) && anyParams.return_date) {
    legs.push({
      origin: destination,
      destination: origin,
      departure_date: String(anyParams.return_date),
    });
  }

  return { legs, passengers, filters };
}

/* -------------------------------------------------- */
/* ---- CACHE KEY ----------------------------------- */
/* -------------------------------------------------- */

function makeCacheKey(body: {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
}): string {
  const legsKey = body.legs
    .map(
      (l) =>
        `${l.origin.toUpperCase()}-${l.destination.toUpperCase()}-${l.departure_date}`
    )
    .join("|");

  const f = body.filters;
  const parts: string[] = [];

  if (f?.airlineCodes?.length) parts.push(`air=${f.airlineCodes.join(",")}`);
  if (f?.minPrice != null) parts.push(`min=${f.minPrice}`);
  if (f?.maxPrice != null) parts.push(`max=${f.maxPrice}`);
  if (f?.departureTimeRange?.from && f?.departureTimeRange?.to)
    parts.push(
      `time=${f.departureTimeRange.from}-${f.departureTimeRange.to}`
    );
  if (f?.maxStops != null) parts.push(`stops=${f.maxStops}`);

  const filtersKey = parts.length ? `:${parts.join(":")}` : "";
  return `flights:${legsKey}:p${body.passengers}${filtersKey}`;
}

/**
 * Builds route keys like ["MAD-BCN-2025-06-15"] for cache invalidation.
 */
function makeRouteKeys(body: { legs: FlightLeg[] }): string[] {
  return body.legs.map(
    (l) =>
      `${l.origin.toUpperCase()}-${l.destination.toUpperCase()}-${l.departure_date}`
  );
}

/* -------------------------------------------------- */
/* ---- UTILITIES ----------------------------------- */
/* -------------------------------------------------- */

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

function validateRequest(body: {
  legs: FlightLeg[];
  passengers: number;
  filters?: FlightSearchFilters;
}): string | null {
  if (!Array.isArray(body.legs) || body.legs.length === 0)
    return "Parámetros inválidos: legs vacío.";
  if (body.legs.length > 6)
    return "Parámetros inválidos: máximo 6 tramos.";
  if (
    !Number.isFinite(body.passengers) ||
    body.passengers < 1 ||
    body.passengers > 9
  )
    return "Parámetros inválidos: passengers fuera de rango (1-9).";

  for (let i = 0; i < body.legs.length; i++) {
    const leg = body.legs[i];
    if (
      !isValidIATA(String(leg.origin ?? "")) ||
      !isValidIATA(String(leg.destination ?? ""))
    ) {
      return `IATA inválido en tramo ${i + 1}.`;
    }
    if (!isValidDateYYYYMMDD(String(leg.departure_date ?? ""))) {
      return `Fecha inválida en tramo ${i + 1} (usa YYYY-MM-DD).`;
    }
    if (String(leg.origin) === String(leg.destination)) {
      return `Origen y destino iguales en tramo ${i + 1}.`;
    }
  }

  const tr = body.filters?.departureTimeRange;
  if (tr) {
    if (!isValidHHMM(tr.from) || !isValidHHMM(tr.to))
      return "Rango horario inválido (usa HH:MM).";
  }

  return null;
}

function safeParseDateIso(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t);
}

/* -------------------------------------------------- */
/* ---- HANDLER ------------------------------------- */
/* -------------------------------------------------- */

export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    // ── 1) RATE LIMIT (C1.3) ─────────────────────────
    const now = new Date();
    const nowIso = now.toISOString();

    const userAgent = req.headers.get("user-agent") || "";
    const ip = getClientIp(req);
    const userId = await getAuthenticatedUserId();

    const rlKey = userId
      ? `user:${userId}`
      : makeRateLimitKey(ip, userAgent);

    const maxPerWindow = userId ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;

    const { data: rlData } = await supabase
      .from("search_rate_limits")
      .select("ip_address,last_search_at,search_count")
      .eq("ip_address", rlKey)
      .maybeSingle();

    const rl = rlData as unknown;
    if (
      isRecord(rl) &&
      isNonEmptyString(rl.last_search_at) &&
      typeof rl.search_count === "number"
    ) {
      const diffMs =
        now.getTime() - new Date(rl.last_search_at).getTime();

      if (rl.search_count >= maxPerWindow && diffMs < RATE_LIMIT_WINDOW_MS) {
        return NextResponse.json(
          {
            error: "Demasiadas búsquedas. Intente de nuevo en breve.",
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }

      const newCount =
        diffMs > RATE_LIMIT_WINDOW_MS ? 1 : rl.search_count + 1;

      await supabase
        .from("search_rate_limits")
        .update({ last_search_at: nowIso, search_count: newCount })
        .eq("ip_address", rlKey);
    } else {
      await supabase.from("search_rate_limits").upsert(
        {
          ip_address: rlKey,
          last_search_at: nowIso,
          search_count: 1,
        },
        { onConflict: "ip_address" }
      );
    }

    // ── 2) Parse + normalize ─────────────────────────
    const raw = (await req.json()) as FlightSearchParams;
    const body = normalizeToRequest(raw);

    const validationErr = validateRequest(body);
    if (validationErr)
      return NextResponse.json(
        { error: validationErr },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );

    const cache_key = makeCacheKey(body);
    const route_keys = makeRouteKeys(body);

    // ── 3) Cache read ────────────────────────────────
    const { data: cached } = await supabase
      .from("flight_search_cache")
      .select("response, expires_at, fresh_until, created_at")
      .eq("cache_key", cache_key)
      .gt("expires_at", nowIso)
      .maybeSingle();

    let status: "pending" | "refreshing" | "complete" = "pending";
    let source: "live" | "cache" | "stale-cache" = "live";
    let initialResults: ResultsByLeg | null = null;
    let providersUsed: string[] = [];

    if (cached?.response) {
      const expiresAt = safeParseDateIso(cached.expires_at);
      if (expiresAt && expiresAt.getTime() > now.getTime()) {
        const freshUntil = safeParseDateIso(
          (cached as unknown as Record<string, unknown>).fresh_until
        );
        const cachedResults: ResultsByLeg = Array.isArray(cached.response)
          ? (cached.response as unknown[])
              .filter(isRecord)
              .map((r) => ({
                legIndex: Number((r as FlightRecord).legIndex ?? 0),
                flights: Array.isArray((r as FlightRecord).flights)
                  ? (
                      ((r as FlightRecord).flights as unknown[]).filter(
                        isRecord
                      ) as FlightRecord[]
                    )
                  : [],
              }))
          : [];

        initialResults = cachedResults;
        providersUsed = extractProvidersUsed(cachedResults);

        const createdAt =
          safeParseDateIso(
            (cached as unknown as Record<string, unknown>).created_at
          ) ?? new Date(expiresAt.getTime() - CACHE_TTL_MINUTES * 60 * 1000);
        const ageMs = now.getTime() - createdAt.getTime();

        if (
          (freshUntil && freshUntil.getTime() > now.getTime()) ||
          ageMs <= FRESH_MS
        ) {
          status = "complete";
          source = "cache";
        } else {
          status = "refreshing";
          source = "stale-cache";
        }
      }
    }

    // ── 4) Create session ────────────────────────────
    const sessionExpiresAt = new Date(
      Date.now() + SESSION_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("flight_search_sessions")
      .insert({
        cache_key,
        request: body,
        status,
        source,
        providers_used: providersUsed,
        results: initialResults,
        error: null,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: sessionExpiresAt,
      })
      .select("session_id")
      .single();

    if (sessionErr || !sessionRow) {
      const msg = String(
        (sessionErr as unknown as { message?: unknown })?.message ?? ""
      );
      console.warn(
        "[FLIGHTS_SEARCH] session insert failed:",
        msg
      );
      return NextResponse.json(
        {
          error:
            "No se pudo crear la sesión de búsqueda. Verifique que la migración 006 esté aplicada en Supabase.",
        },
        { status: 500 }
      );
    }

    const sessionId = String(
      (sessionRow as unknown as Record<string, unknown>).session_id
    );

    const payload: Record<string, unknown> = {
      sessionId,
      status,
      source,
    };
    if (initialResults) payload.results = initialResults;
    if (providersUsed.length) payload.providersUsed = providersUsed;

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err: unknown) {
    console.error("[FLIGHT_SEARCH_ERROR]", err);
    const msg =
      err instanceof Error
        ? err.message
        : String(err ?? "Internal server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
