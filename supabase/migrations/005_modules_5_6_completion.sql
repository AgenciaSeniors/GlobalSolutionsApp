-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Migration 005: Modules 5 & 6 Completion
-- Agent Commissions, Loyalty Automation,
-- Ticket Messages Enhancement, RLS Hardening
-- ============================================

-- ============================================
-- 1. AGENT COMMISSIONS TABLE (Module 5)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  base_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON agent_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_booking ON agent_commissions(booking_id);

ALTER TABLE agent_commissions ENABLE ROW LEVEL SECURITY;

-- Agents see own commissions, admins see all
CREATE POLICY "Agents view own commissions"
  ON agent_commissions FOR SELECT USING (
    auth.uid() = agent_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "System inserts commissions"
  ON agent_commissions FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() = agent_id
  );

CREATE POLICY "Admins manage commissions"
  ON agent_commissions FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER update_agent_commissions_updated_at
  BEFORE UPDATE ON agent_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. AUTO-GENERATE COMMISSION ON BOOKING CONFIRMED
-- ============================================
CREATE OR REPLACE FUNCTION auto_generate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when booking_status changes to 'confirmed' and there's an agent
  IF NEW.booking_status = 'confirmed'
     AND OLD.booking_status IS DISTINCT FROM 'confirmed'
     AND NEW.assigned_agent_id IS NOT NULL THEN

    INSERT INTO agent_commissions (
      agent_id,
      booking_id,
      commission_rate,
      base_amount,
      commission_amount,
      status
    ) VALUES (
      NEW.assigned_agent_id,
      NEW.id,
      5.00,
      NEW.subtotal,
      ROUND(NEW.subtotal * 0.05, 2),
      'pending'
    )
    ON CONFLICT (agent_id, booking_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_commission ON bookings;
CREATE TRIGGER trigger_auto_commission
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION auto_generate_commission();

-- ============================================
-- 3. AWARD LOYALTY POINTS ON REVIEW APPROVAL
-- ============================================
CREATE OR REPLACE FUNCTION auto_award_review_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    -- 50 points for a text review, 100 if they included photos
    PERFORM add_loyalty_points(
      NEW.user_id,
      CASE WHEN array_length(NEW.photo_urls, 1) > 0 THEN 100 ELSE 50 END,
      CASE WHEN array_length(NEW.photo_urls, 1) > 0
        THEN 'Reseña aprobada con fotos'
        ELSE 'Reseña aprobada'
      END,
      'review',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_review_points ON reviews;
CREATE TRIGGER trigger_review_points
  AFTER UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION auto_award_review_points();

-- ============================================
-- 4. AWARD LOYALTY POINTS ON BOOKING COMPLETED
-- ============================================
CREATE OR REPLACE FUNCTION auto_award_booking_points()
RETURNS TRIGGER AS $$
DECLARE
  points_per_dollar INT;
BEGIN
  IF NEW.booking_status = 'completed'
     AND OLD.booking_status IS DISTINCT FROM 'completed'
     AND NEW.user_id IS NOT NULL THEN

    -- Read config from app_settings
    SELECT COALESCE((value)::INT, 1) INTO points_per_dollar
    FROM app_settings WHERE key = 'loyalty_points_per_dollar';

    IF points_per_dollar IS NULL THEN points_per_dollar := 1; END IF;

    PERFORM add_loyalty_points(
      NEW.user_id,
      GREATEST(1, FLOOR(NEW.total_amount * points_per_dollar)::INT),
      'Puntos por reserva completada',
      'booking',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_booking_points ON bookings;
CREATE TRIGGER trigger_booking_points
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION auto_award_booking_points();

-- ============================================
-- 5. ADD MISSING COLUMNS TO agent_tickets
-- (The ticket_messages system exists but the service
--  was writing to a non-existent 'message' column)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_tickets' AND column_name = 'description'
  ) THEN
    ALTER TABLE agent_tickets ADD COLUMN description TEXT;
  END IF;
END $$;

-- ============================================
-- 6. RLS POLICY FOR agent_ticket_messages INSERT
-- Allow agents to create ticket messages
-- ============================================
-- (Already exists in 002, but ensure agent can also insert on own tickets)

-- ============================================
-- 7. Add default commission rate to app_settings
-- ============================================
INSERT INTO app_settings (key, value, description) VALUES
  ('default_commission_rate', '5.00', 'Default agent commission % on confirmed bookings'),
  ('loyalty_points_review', '50', 'Points awarded for approved text review'),
  ('loyalty_points_review_photo', '100', 'Points awarded for approved review with photos')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 8. VIEW: Agent commission summary
-- ============================================
CREATE OR REPLACE VIEW agent_commission_summary AS
SELECT
  ac.agent_id,
  p.full_name AS agent_name,
  p.agent_code,
  COUNT(*) AS total_commissions,
  COUNT(*) FILTER (WHERE ac.status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE ac.status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE ac.status = 'paid') AS paid_count,
  COALESCE(SUM(ac.commission_amount), 0) AS total_earned,
  COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'pending'), 0) AS pending_amount,
  COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'paid'), 0) AS paid_amount
FROM agent_commissions ac
JOIN profiles p ON p.id = ac.agent_id
GROUP BY ac.agent_id, p.full_name, p.agent_code;
