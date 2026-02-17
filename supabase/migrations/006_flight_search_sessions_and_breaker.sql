-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Flight Search sessions + circuit breaker (C1.1)
-- Migration: 006_flight_search_sessions_and_breaker.sql
--
-- Notes:
-- - Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS to be safe across environments.
-- - These tables are only accessed via service role from API routes.
-- ============================================

-- ------------------------------
-- flight_search_cache
-- ------------------------------
CREATE TABLE IF NOT EXISTS flight_search_cache (
  cache_key TEXT PRIMARY KEY,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE flight_search_cache
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_expires_at
  ON flight_search_cache (expires_at);

-- ------------------------------
-- search_rate_limits
-- ------------------------------
CREATE TABLE IF NOT EXISTS search_rate_limits (
  ip_address TEXT PRIMARY KEY,
  last_search_at TIMESTAMPTZ,
  search_count INT NOT NULL DEFAULT 0
);

-- ------------------------------
-- provider_circuit_breakers
-- ------------------------------
CREATE TABLE IF NOT EXISTS provider_circuit_breakers (
  provider_id TEXT PRIMARY KEY,
  failure_count INT NOT NULL DEFAULT 0,
  first_failure_at TIMESTAMPTZ,
  open_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_circuit_open_until
  ON provider_circuit_breakers (open_until);

-- ------------------------------
-- flight_search_sessions
-- ------------------------------
CREATE TABLE IF NOT EXISTS flight_search_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT,
  request JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'refreshing', 'running', 'complete', 'failed')),
  source TEXT,
  providers_used TEXT[],
  results JSONB,
  error TEXT,
  worker_started_at TIMESTAMPTZ,
  worker_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_flight_search_sessions_expires_at
  ON flight_search_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_flight_search_sessions_status
  ON flight_search_sessions (status);
