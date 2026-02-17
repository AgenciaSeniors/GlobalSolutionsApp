-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- C1.2 + C1.3 support:
-- - Smart flight search cache metadata (fresh_until + route_keys)
-- - Cache invalidation on flights.available_seats changes (route-based)
-- Migration: 007_flight_search_cache_invalidation.sql
-- ============================================

-- ------------------------------
-- flight_search_cache extensions
-- ------------------------------
ALTER TABLE flight_search_cache
  ADD COLUMN IF NOT EXISTS fresh_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS route_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_fresh_until
  ON flight_search_cache (fresh_until);

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_route_keys
  ON flight_search_cache USING GIN (route_keys);

-- Backfill fresh_until for existing rows (best-effort)
UPDATE flight_search_cache
SET fresh_until = COALESCE(fresh_until, created_at + INTERVAL '5 minutes')
WHERE fresh_until IS NULL AND created_at IS NOT NULL;

-- ------------------------------
-- Cache invalidation on inventory seat changes
-- ------------------------------
CREATE OR REPLACE FUNCTION invalidate_flight_search_cache_on_seats_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  origin_iata TEXT;
  dest_iata TEXT;
  dep_date TEXT;
  rkey TEXT;
BEGIN
  IF NEW.available_seats IS DISTINCT FROM OLD.available_seats THEN
    SELECT iata_code INTO origin_iata FROM airports WHERE id = NEW.origin_airport_id;
    SELECT iata_code INTO dest_iata FROM airports WHERE id = NEW.destination_airport_id;

    -- Use UTC date to match API leg departure_date (YYYY-MM-DD)
    dep_date := to_char((NEW.departure_datetime AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD');

    IF origin_iata IS NOT NULL AND dest_iata IS NOT NULL THEN
      rkey := origin_iata || '-' || dest_iata || '-' || dep_date;

      -- Delete cached searches that include this route leg
      DELETE FROM flight_search_cache
      WHERE route_keys @> ARRAY[rkey];
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_flight_search_cache_on_seats_update ON flights;

CREATE TRIGGER trg_invalidate_flight_search_cache_on_seats_update
AFTER UPDATE OF available_seats ON flights
FOR EACH ROW
EXECUTE FUNCTION invalidate_flight_search_cache_on_seats_update();
