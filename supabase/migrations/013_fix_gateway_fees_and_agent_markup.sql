-- ============================================
-- Migration 013: Fix gateway fees + add agent_markup_percentage
--
-- Fixes:
-- 1. Stripe/PayPal fee percentages were seeded at 5.40% instead of real rates
-- 2. agent_markup_percentage was missing from app_settings
-- ============================================

-- Fix gateway fees to real processor rates
UPDATE app_settings SET value = '2.90'  WHERE key = 'stripe_fee_percentage';
UPDATE app_settings SET value = '0.30'  WHERE key = 'stripe_fee_fixed';
UPDATE app_settings SET value = '3.49'  WHERE key = 'paypal_fee_percentage';
UPDATE app_settings SET value = '0.49'  WHERE key = 'paypal_fee_fixed';

-- Add agent_markup_percentage if not already present
INSERT INTO app_settings (key, value, description)
VALUES ('agent_markup_percentage', '10.00', 'Markup % applied to agents (role=agent). Not summed with client markup.')
ON CONFLICT (key) DO NOTHING;
