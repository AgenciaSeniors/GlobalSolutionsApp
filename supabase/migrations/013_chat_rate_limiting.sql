-- Migration: 013_chat_rate_limiting
-- Purpose: Create rate limiting table and RPC for the AI chat widget.
-- The /api/chat route calls increment_chat_rate_limit() to limit messages
-- per IP per minute, but the function was never created in the DB.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_rate_limit_tokens (
  key        TEXT        PRIMARY KEY,
  count      INT         NOT NULL DEFAULT 0,
  window_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 minute')
);

-- Only the SECURITY DEFINER function below can touch this table.
ALTER TABLE public.chat_rate_limit_tokens ENABLE ROW LEVEL SECURITY;

-- ─── RPC ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_chat_rate_limit(
  p_key   TEXT,
  p_limit INT
)
RETURNS TABLE(allowed BOOLEAN, count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count      INT;
  v_window_end TIMESTAMPTZ;
BEGIN
  -- Try to lock the existing row for this key
  SELECT c.count, c.window_end
    INTO v_count, v_window_end
    FROM chat_rate_limit_tokens c
   WHERE c.key = p_key
     FOR UPDATE;

  IF NOT FOUND OR NOW() > v_window_end THEN
    -- No row yet, or the minute window has expired → reset to 1
    INSERT INTO chat_rate_limit_tokens (key, count, window_end)
    VALUES (p_key, 1, NOW() + INTERVAL '1 minute')
    ON CONFLICT (key) DO UPDATE
       SET count      = 1,
           window_end = NOW() + INTERVAL '1 minute';

    RETURN QUERY SELECT TRUE::BOOLEAN, 1::INT;
  ELSE
    -- Still inside the current window → increment
    UPDATE chat_rate_limit_tokens
       SET count = count + 1
     WHERE key = p_key;

    v_count := v_count + 1;
    RETURN QUERY SELECT (v_count <= p_limit)::BOOLEAN, v_count::INT;
  END IF;
END;
$$;

-- Grant execute to all relevant roles (anon callers for unauthenticated chat)
GRANT EXECUTE ON FUNCTION public.increment_chat_rate_limit(TEXT, INT)
  TO anon, authenticated, service_role;
