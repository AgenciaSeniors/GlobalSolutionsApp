-- ============================================
-- LOYALTY AWARDS ON TRIP COMPLETION (Module 6)
-- Migration: 004_loyalty_awards.sql
-- ============================================

-- Awards loyalty points when a booking transitions to `completed`.
-- Points = floor(total_amount * loyalty_points_per_dollar).

CREATE OR REPLACE FUNCTION award_loyalty_on_booking_completed()
RETURNS TRIGGER AS $$
DECLARE
  points_per_dollar INT := 1;
  raw_value TEXT;
  points INT;
BEGIN
  IF NEW.booking_status = 'completed' AND (OLD.booking_status IS DISTINCT FROM 'completed') THEN
    SELECT value INTO raw_value
    FROM app_settings
    WHERE key = 'loyalty_points_per_dollar'
    LIMIT 1;

    IF raw_value IS NOT NULL THEN
      points_per_dollar := GREATEST(0, COALESCE(NULLIF(raw_value, '')::INT, 1));
    END IF;

    points := FLOOR(COALESCE(NEW.total_amount, 0) * points_per_dollar);

    IF points > 0 THEN
      PERFORM add_loyalty_points(
        NEW.user_id,
        points,
        'trip_completed',
        'booking',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_loyalty_on_booking_completed ON bookings;
CREATE TRIGGER trg_award_loyalty_on_booking_completed
  AFTER UPDATE OF booking_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_on_booking_completed();
