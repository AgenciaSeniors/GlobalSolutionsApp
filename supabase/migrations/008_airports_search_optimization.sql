-- ============================================================
-- Migration 008: Airport search optimization
-- Dev B - Sprint 1: API Aeropuertos autocomplete enhancement
-- ============================================================

-- Enable pg_trgm for trigram-based fuzzy search (tolerant of typos)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent for accent-insensitive search (Habana = Habana, Panamá = Panama)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create an immutable wrapper for unaccent (needed for index usage)
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Add a composite search column for optimized trigram matching
-- Combines city, name, iata_code, and country into one searchable text
ALTER TABLE airports ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    lower(immutable_unaccent(city || ' ' || name || ' ' || iata_code || ' ' || country))
  ) STORED;

-- GIN trigram index on the generated search_text column
CREATE INDEX IF NOT EXISTS idx_airports_search_trgm
  ON airports USING gin (search_text gin_trgm_ops);

-- Standard btree index on country for exact country code lookups
CREATE INDEX IF NOT EXISTS idx_airports_country
  ON airports USING btree (country);
