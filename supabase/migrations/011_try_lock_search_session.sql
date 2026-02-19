-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- C1.1: Atomic session locking for flight search workers
-- Migration: 011_try_lock_search_session.sql
--
-- Fixes: The search polling endpoint calls this RPC to acquire
-- an exclusive lock before starting a background search worker.
-- Without it, lockAcquired is always NULL and workers never start.
-- ============================================

-- ------------------------------
-- try_lock_search_session RPC
-- ------------------------------
-- Atomically attempts to claim a search session for background execution.
-- Returns TRUE if this caller acquired the lock, FALSE otherwise.
--
-- Lock is granted when:
--   1. Session status is 'pending' or 'refreshing' (not yet running)
--   2. No active worker exists (worker_started_at IS NULL)
--      OR the existing worker is stale (heartbeat older than threshold)
--
-- The UPDATE + ROW_COUNT pattern ensures only ONE concurrent caller
-- can acquire the lock for a given session (PostgreSQL row-level locking).

CREATE OR REPLACE FUNCTION try_lock_search_session(
  p_session_id UUID,
  p_now TIMESTAMPTZ,
  p_stale_threshold TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE flight_search_sessions
  SET
    status = 'running',
    worker_started_at = p_now,
    worker_heartbeat = p_now,
    updated_at = p_now
  WHERE session_id = p_session_id
    AND status IN ('pending', 'refreshing')
    AND (worker_started_at IS NULL OR worker_heartbeat < p_stale_threshold);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
