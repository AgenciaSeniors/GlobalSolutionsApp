import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple DB-backed circuit breaker for external providers.
 *
 * Policy (C1.1): if provider fails N times inside WINDOW, open for OPEN_MS.
 */
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 5 * 60 * 1000; // 5 minutes

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

export async function isCircuitOpen(providerId: string): Promise<{ open: boolean; openUntil?: string }>
{
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

    return { open: false };
  } catch {
    // Fail-open: if the breaker storage is unavailable, do not block results.
    return { open: false };
  }
}

export async function recordProviderSuccess(providerId: string): Promise<void> {
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
  } catch {
    // ignore
  }
}

export async function recordProviderFailure(providerId: string): Promise<void> {
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
    let failureCount = typeof row?.failure_count === "number" ? row!.failure_count : 0;

    // Reset window if outside it
    if (now.getTime() - firstFailureAt.getTime() > WINDOW_MS) {
      firstFailureAt = now;
      failureCount = 0;
    }

    failureCount += 1;

    const shouldOpen = failureCount >= FAILURE_THRESHOLD;
    const openUntil = shouldOpen ? new Date(now.getTime() + OPEN_MS) : null;

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
