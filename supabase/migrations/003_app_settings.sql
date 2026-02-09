-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Migration 003: Admin Settings Table
-- Stores global business configuration:
--   default markup, gateway fees, SLA hours
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed for price calculations)
CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT USING (true);

-- Only admins can modify
CREATE POLICY "Admins manage settings"
  ON app_settings FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================
-- SEED: Default business configuration
-- ============================================
INSERT INTO app_settings (key, value, description) VALUES
  ('default_markup_percentage', '10.00', 'Default markup % applied to new flights'),
  ('stripe_fee_percentage', '5.40', 'Stripe gateway fee %'),
  ('stripe_fee_fixed', '0.30', 'Stripe fixed fee per transaction ($)'),
  ('paypal_fee_percentage', '5.40', 'PayPal gateway fee %'),
  ('paypal_fee_fixed', '0.30', 'PayPal fixed fee per transaction ($)'),
  ('zelle_fee_percentage', '0.00', 'Zelle gateway fee % (manual transfer)'),
  ('zelle_fee_fixed', '0.00', 'Zelle fixed fee per transaction ($)'),
  ('emission_sla_hours', '24', 'Maximum hours to emit tickets after payment'),
  ('emission_warning_hours', '12', 'Hours before SLA when warning appears'),
  ('min_markup_percentage', '5.00', 'Minimum allowed markup %'),
  ('max_markup_percentage', '50.00', 'Maximum allowed markup %'),
  ('review_request_delay_days', '1', 'Days after return_date to request review'),
  ('loyalty_points_per_dollar', '1', 'Loyalty points awarded per dollar spent'),
  ('business_name', '"Global Solutions Travel"', 'Display name for PDFs and emails'),
  ('business_email', '"admin@globalsolutionstravel.com"', 'Main contact email'),
  ('business_phone', '"+1 (305) 555-0100"', 'Main contact phone'),
  ('business_address', '"Miami, FL, USA"', 'Physical address for invoices'),
  ('currency', '"USD"', 'Primary currency code')
ON CONFLICT (key) DO NOTHING;
