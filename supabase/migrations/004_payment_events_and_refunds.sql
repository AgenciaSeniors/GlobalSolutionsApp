-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Migration 004: Payment Events & Webhook Idempotency
-- Adds: payment_events table, RPC functions for idempotency
-- Module 2: Financial Infrastructure
-- ============================================

-- ============================================
-- PAYMENT EVENTS TABLE (Audit trail for all payment providers)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('stripe', 'paypal', 'zelle')),
  event_id VARCHAR(255), -- Provider's event ID (e.g., Stripe's evt_xxx, PayPal's event id)
  event_type VARCHAR(100) NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  payment_intent_id TEXT, -- provider's payment/order ID
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint to prevent duplicates
  UNIQUE(provider, event_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_events_booking ON payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at);

-- Enable RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view payment events (sensitive data)
CREATE POLICY "Admins can view payment events"
  ON payment_events FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================
-- RPC: Log Payment Event with Idempotency (Generic)
-- Returns: TRUE if inserted, FALSE if duplicate
-- ============================================
CREATE OR REPLACE FUNCTION log_payment_event_once(
  p_provider VARCHAR(20),
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_booking_id UUID,
  p_payment_intent_id TEXT,
  p_payload JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  inserted BOOLEAN := FALSE;
BEGIN
  -- Attempt to insert, ignore if duplicate
  INSERT INTO payment_events (
    provider, 
    event_id, 
    event_type, 
    booking_id, 
    payment_intent_id, 
    payload
  ) VALUES (
    p_provider,
    p_event_id,
    p_event_type,
    p_booking_id,
    p_payment_intent_id,
    p_payload
  )
  ON CONFLICT (provider, event_id) DO NOTHING;
  
  -- Check if insert happened
  IF FOUND THEN
    inserted := TRUE;
  END IF;
  
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Log Stripe Event (wrapper for backward compatibility)
-- ============================================
CREATE OR REPLACE FUNCTION log_stripe_event_once(
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_booking_id UUID,
  p_payment_intent_id TEXT,
  p_payload JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN log_payment_event_once(
    'stripe',
    p_event_id,
    p_event_type,
    p_booking_id,
    p_payment_intent_id,
    p_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Log PayPal Event (wrapper for convenience)
-- ============================================
CREATE OR REPLACE FUNCTION log_paypal_event_once(
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_booking_id UUID,
  p_order_id TEXT,
  p_payload JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN log_payment_event_once(
    'paypal',
    p_event_id,
    p_event_type,
    p_booking_id,
    p_order_id,
    p_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE BOOKINGS: Add pricing_breakdown field
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'pricing_breakdown'
  ) THEN
    ALTER TABLE bookings ADD COLUMN pricing_breakdown JSONB;
  END IF;
END $$;

-- ============================================
-- UPDATE BOOKINGS: Add refund fields
-- ============================================
DO $$
BEGIN
  -- Refund amount (if partial)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'refund_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refund_amount DECIMAL(10,2);
  END IF;
  
  -- Refund reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refund_reason VARCHAR(50);
  END IF;
  
  -- Refund timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN refunded_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- Update payment_status constraint to include 'refunded'
-- ============================================
ALTER TABLE bookings 
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE bookings 
  ADD CONSTRAINT bookings_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

-- ============================================
-- Update booking_status constraint to include 'refunded'
-- ============================================
ALTER TABLE bookings 
  DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings 
  ADD CONSTRAINT bookings_booking_status_check 
  CHECK (booking_status IN ('pending_emission', 'confirmed', 'cancelled', 'completed', 'refunded'));
