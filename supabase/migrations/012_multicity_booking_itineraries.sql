-- Migration: 012_multicity_booking_itineraries
-- Adds support for multi-leg (multicity) bookings:
--   • booking_itineraries table to store each leg of a multicity booking
--   • trip_type column on bookings to differentiate oneway/roundtrip/multicity

-- ------------------------------------------------------------------ --
-- TABLE: booking_itineraries
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS booking_itineraries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  leg_index           INT NOT NULL,           -- 0-based: tramo 1 = 0, tramo 2 = 1, etc.
  flight_id           UUID REFERENCES flights(id) ON DELETE SET NULL,
  flight_provider_id  TEXT,                  -- ID externo del proveedor (Duffel / SkyScanner)
  origin_iata         VARCHAR(3) NOT NULL,
  destination_iata    VARCHAR(3) NOT NULL,
  departure_datetime  TIMESTAMPTZ,
  arrival_datetime    TIMESTAMPTZ,
  subtotal            DECIMAL(10,2) NOT NULL, -- precio de este tramo × pasajeros
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, leg_index)
);

CREATE INDEX IF NOT EXISTS idx_booking_itineraries_booking
  ON booking_itineraries(booking_id);

-- ------------------------------------------------------------------ --
-- RLS
-- ------------------------------------------------------------------ --
ALTER TABLE booking_itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own itineraries"
  ON booking_itineraries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_itineraries.booking_id
        AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own itineraries"
  ON booking_itineraries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_itineraries.booking_id
        AND bookings.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------ --
-- ALTER bookings: add trip_type
-- ------------------------------------------------------------------ --
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS trip_type VARCHAR(20) DEFAULT 'oneway'
    CHECK (trip_type IN ('oneway', 'roundtrip', 'multicity'));
