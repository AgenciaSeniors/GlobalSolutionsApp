import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple DB-backed circuit breaker for external providers.
 *
 * Policy (C1.1): if provider fails N times inside WINDOW, open for OPEN_MS.
 *
 * v2 — Improvements:
 *   1. Added periodic cleanup of stale circuit breaker records
 *   2. Improved logging for breaker state transitions
 *   3. Fail-open semantics preserved (storage errors never block searches)
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 5 * 60 * 1000; // 5 minutes

/** Stale records older than this are cleaned up periodically */
const STALE_RECORD_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Last cleanup timestamp (in-memory, per-process) */
let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type CircuitRow = {
  provider_id: string;
  failure_count: number;
  first_failure_at: string | null;
  open_until: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

/* -------------------------------------------------- */
/* ---- PUBLIC API ---------------------------------- */
/* -------------------------------------------------- */

export async function isCircuitOpen(
  providerId: string
): Promise<{ open: boolean; openUntil?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("provider_circuit_breakers")
      .select("provider_id,failure_count,first_failure_at,open_until")
      .eq("provider_id", providerId)
      .maybeSingle();

    if (error || !data) return { open: false };

    const row = data as unknown as CircuitRow;
    const openUntil = safeDate(row.open_until);
    if (openUntil && openUntil.getTime() > Date.now()) {
      return { open: true, openUntil: openUntil.toISOString() };
    }

    // If circuit was open but has expired, reset it proactively
    if (openUntil && openUntil.getTime() <= Date.now() && row.failure_count > 0) {
      // Best-effort reset — don't block on this
      void resetCircuit(supabase, providerId);
    }

    return { open: false };
  } catch {
    // Fail-open: if the breaker storage is unavailable, do not block results.
    return { open: false };
  }
}

export async function recordProviderSuccess(
  providerId: string
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("provider_circuit_breakers")
      .upsert(
        {
          provider_id: providerId,
          failure_count: 0,
          first_failure_at: null,
          open_until: null,
          updated_at: nowIso(),
        },
        { onConflict: "provider_id" }
      );

    // Periodic cleanup
    await maybeCleanupStaleRecords(supabase);
  } catch {
    // ignore
  }
}

export async function recordProviderFailure(
  providerId: string
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("provider_circuit_breakers")
      .select("provider_id,failure_count,first_failure_at,open_until")
      .eq("provider_id", providerId)
      .maybeSingle();

    const now = new Date();
    const row = (data as unknown as CircuitRow | null) ?? null;

    let firstFailureAt = safeDate(row?.first_failure_at) ?? now;
    let failureCount =
      typeof row?.failure_count === "number" ? row.failure_count : 0;

    // Reset window if outside it
    if (now.getTime() - firstFailureAt.getTime() > WINDOW_MS) {
      firstFailureAt = now;
      failureCount = 0;
    }

    failureCount += 1;

    const shouldOpen = failureCount >= FAILURE_THRESHOLD;
    const openUntil = shouldOpen
      ? new Date(now.getTime() + OPEN_MS)
      : null;

    if (shouldOpen) {
      console.warn(
        `[CircuitBreaker] OPENING circuit for ${providerId} — ${failureCount} failures in window. Open until ${openUntil?.toISOString()}`
      );
    }

    await supabase
      .from("provider_circuit_breakers")
      .upsert(
        {
          provider_id: providerId,
          failure_count: failureCount,
          first_failure_at: firstFailureAt.toISOString(),
          open_until: openUntil ? openUntil.toISOString() : null,
          updated_at: now.toISOString(),
        },
        { onConflict: "provider_id" }
      );
  } catch {
    // ignore
  }
}

/* -------------------------------------------------- */
/* ---- INTERNAL ------------------------------------ */
/* -------------------------------------------------- */

async function resetCircuit(
  supabase: ReturnType<typeof createAdminClient>,
  providerId: string
): Promise<void> {
  try {
    await supabase
      .from("provider_circuit_breakers")
      .update({
        failure_count: 0,
        first_failure_at: null,
        open_until: null,
        updated_at: nowIso(),
      })
      .eq("provider_id", providerId);

    console.log(`[CircuitBreaker] Reset circuit for ${providerId}`);
  } catch {
    // ignore
  }
}

/**
 * Periodically clean up stale rate limit and session records.
 * Runs at most once per CLEANUP_INTERVAL_MS per process.
 */
async function maybeCleanupStaleRecords(
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  try {
    const staleThreshold = new Date(
      now - STALE_RECORD_MS
    ).toISOString();

    // Clean expired sessions
    await supabase
      .from("flight_search_sessions")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Clean expired cache entries
    await supabase
      .from("flight_search_cache")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // Clean stale rate limit records (no activity in 24h)
    await supabase
      .from("search_rate_limits")
      .delete()
      .lt("last_search_at", staleThreshold);

    console.log("[CircuitBreaker] Periodic cleanup completed");
  } catch {
    // Non-fatal — cleanup is best-effort
  }
}
