-- ============================================================
-- Migration 009: Allow service_role to insert/update airports
-- Dev B - Enables background airport caching from API results
-- ============================================================

-- Allow service_role to insert new airports (from external API cache)
CREATE POLICY "Service role can insert airports"
  ON airports FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service_role to update airports (for upsert on conflict)
CREATE POLICY "Service role can update airports"
  ON airports FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
