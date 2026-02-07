-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Migration 002: Full Spec Compliance
-- Adds: special_offers, agent_tickets, quotation_requests
-- Updates: bookings (return_date, emission fields)
-- ============================================

-- ============================================
-- SPECIAL OFFERS (Visual Engine per spec §3.2)
-- ============================================
CREATE TABLE IF NOT EXISTS special_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination TEXT NOT NULL,
  destination_img TEXT NOT NULL,
  description TEXT,
  route TEXT NOT NULL,           -- e.g. 'HAV → IST'
  airline_id UUID REFERENCES airlines(id),
  original_price DECIMAL(10,2) NOT NULL,
  offer_price DECIMAL(10,2) NOT NULL,
  valid_dates DATE[] NOT NULL,   -- Array of specific dates
  urgency_tag TEXT,              -- '¡Quedan pocos cupos!', 'Oferta Flash 24h', etc.
  is_fire BOOLEAN DEFAULT false, -- Fire icon toggle
  available_seats INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- QUOTATION REQUESTS (Spec §3.3 Fallback)
-- ============================================
CREATE TABLE IF NOT EXISTS quotation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE,
  passengers INT DEFAULT 1,
  trip_type VARCHAR(20) DEFAULT 'roundtrip',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'quoted', 'accepted', 'expired')),
  assigned_agent_id UUID REFERENCES profiles(id),
  quoted_price DECIMAL(10,2),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT TICKETS (Spec §2.2 Internal Comms)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(10) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT NEWS UPDATES (add priority levels)
-- ============================================
-- agent_news already exists in 001, just ensure columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_news' AND column_name = 'is_pinned') THEN
    ALTER TABLE agent_news ADD COLUMN is_pinned BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- UPDATE BOOKINGS (add emission fields per spec §6)
-- ============================================
DO $$
BEGIN
  -- Return date for review trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'return_date') THEN
    ALTER TABLE bookings ADD COLUMN return_date DATE;
  END IF;

  -- PNR airline (admin fills after emission)
  -- Already exists as airline_pnr in 001, skip

  -- Emission timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'emitted_at') THEN
    ALTER TABLE bookings ADD COLUMN emitted_at TIMESTAMPTZ;
  END IF;

  -- PDF URL (generated after emission)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'voucher_pdf_url') THEN
    ALTER TABLE bookings ADD COLUMN voucher_pdf_url TEXT;
  END IF;

  -- Admin who emitted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'emitted_by') THEN
    ALTER TABLE bookings ADD COLUMN emitted_by UUID REFERENCES profiles(id);
  END IF;

  -- Payment method detail
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_method_detail') THEN
    ALTER TABLE bookings ADD COLUMN payment_method_detail TEXT;
  END IF;

  -- Review sent flag (for trigger logic)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'review_requested') THEN
    ALTER TABLE bookings ADD COLUMN review_requested BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- UPDATE BOOKING_PASSENGERS (ticket numbers per spec §6.1)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_passengers' AND column_name = 'ticket_number') THEN
    ALTER TABLE booking_passengers ADD COLUMN ticket_number TEXT;
  END IF;
END $$;

-- ============================================
-- FLIGHTS: add baggage info per spec §3.4
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flights' AND column_name = 'baggage_included') THEN
    ALTER TABLE flights ADD COLUMN baggage_included TEXT DEFAULT '23kg checked + 8kg carry-on';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'flights' AND column_name = 'stops') THEN
    ALTER TABLE flights ADD COLUMN stops JSONB DEFAULT '[]'::jsonb;
    -- Format: [{"airport":"MIA","duration_minutes":120}]
  END IF;
END $$;

-- ============================================
-- RLS for new tables
-- ============================================

ALTER TABLE special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tickets ENABLE ROW LEVEL SECURITY;

-- SPECIAL OFFERS (public read, admin write)
CREATE POLICY "Anyone can view active offers"
  ON special_offers FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage offers"
  ON special_offers FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- QUOTATION REQUESTS
CREATE POLICY "Users view own quotations"
  ON quotation_requests FOR SELECT USING (
    auth.uid() = user_id
    OR auth.jwt() ->> 'role' IN ('agent', 'admin')
  );
CREATE POLICY "Anyone can create quotation"
  ON quotation_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage quotations"
  ON quotation_requests FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('agent', 'admin')
  );

-- AGENT TICKETS
CREATE POLICY "Agents view own tickets"
  ON agent_tickets FOR SELECT USING (
    auth.uid() = agent_id
    OR auth.jwt() ->> 'role' = 'admin'
  );
CREATE POLICY "Agents create tickets"
  ON agent_tickets FOR INSERT WITH CHECK (
    auth.uid() = agent_id
  );
CREATE POLICY "Admins respond to tickets"
  ON agent_tickets FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================
-- SEED: Sample Special Offers
-- ============================================
INSERT INTO special_offers (destination, destination_img, description, route, original_price, offer_price, valid_dates, urgency_tag, is_fire, available_seats) VALUES
  ('Estambul, Turquía', '/images/destinations/istanbul.jpg', 'Descubre la magia del Bósforo con Turkish Airlines', 'HAV → IST', 1250.00, 849.00, ARRAY['2026-03-01','2026-03-08','2026-03-15','2026-03-22']::DATE[], '¡Quedan pocos cupos!', true, 3),
  ('Madrid, España', '/images/destinations/madrid.jpg', 'Vive la capital con vuelo directo Iberia', 'HAV → MAD', 980.00, 699.00, ARRAY['2026-03-05','2026-03-12','2026-03-19','2026-03-26','2026-04-02']::DATE[], 'Oferta Flash', true, 7),
  ('Cancún, México', '/images/destinations/cancun.jpg', 'Playas paradisíacas al mejor precio', 'HAV → CUN', 450.00, 299.00, ARRAY['2026-02-14','2026-02-21','2026-02-28','2026-03-07']::DATE[], NULL, false, 12),
  ('Panamá City', '/images/destinations/panama.jpg', 'Hub de las Américas con Copa Airlines', 'HAV → PTY', 620.00, 449.00, ARRAY['2026-03-10','2026-03-17','2026-03-24']::DATE[], '¡Solo 5 asientos!', true, 5);

-- ============================================
-- SEED: Sample flights with stops and baggage
-- ============================================
-- Get airline and airport IDs for seeding
DO $$
DECLARE
  tk_id UUID; ib_id UUID; vb_id UUID; cm_id UUID;
  hav_id UUID; ist_id UUID; mad_id UUID; cun_id UUID; pty_id UUID; mia_id UUID;
BEGIN
  SELECT id INTO tk_id FROM airlines WHERE iata_code = 'TK';
  SELECT id INTO ib_id FROM airlines WHERE iata_code = 'IB';
  SELECT id INTO vb_id FROM airlines WHERE iata_code = 'VB';
  SELECT id INTO cm_id FROM airlines WHERE iata_code = 'CM';

  SELECT id INTO hav_id FROM airports WHERE iata_code = 'HAV';
  SELECT id INTO ist_id FROM airports WHERE iata_code = 'IST';
  SELECT id INTO mad_id FROM airports WHERE iata_code = 'MAD';
  SELECT id INTO cun_id FROM airports WHERE iata_code = 'CUN';
  SELECT id INTO pty_id FROM airports WHERE iata_code = 'PTY';
  SELECT id INTO mia_id FROM airports WHERE iata_code = 'MIA';

  INSERT INTO flights (airline_id, flight_number, origin_airport_id, destination_airport_id, departure_datetime, arrival_datetime, base_price, markup_percentage, total_seats, available_seats, aircraft_type, is_exclusive_offer, baggage_included, stops) VALUES
    (tk_id, 'TK1800', hav_id, ist_id, '2026-03-15 22:00:00+00', '2026-03-16 18:30:00+00', 1050.00, 12.00, 280, 45, 'Boeing 777-300ER', true, '30kg checked + 8kg carry-on', '[{"airport":"MIA","duration_minutes":180}]'),
    (ib_id, 'IB6624', hav_id, mad_id, '2026-03-20 10:00:00+00', '2026-03-20 23:15:00+00', 820.00, 10.00, 220, 62, 'Airbus A330-200', true, '23kg checked + 8kg carry-on', '[]'),
    (vb_id, 'VB3201', hav_id, cun_id, '2026-03-12 08:00:00+00', '2026-03-12 10:45:00+00', 250.00, 15.00, 186, 30, 'Airbus A320', false, '15kg checked + 7kg carry-on', '[]'),
    (cm_id, 'CM0435', hav_id, pty_id, '2026-03-18 14:30:00+00', '2026-03-18 18:00:00+00', 480.00, 10.00, 160, 18, 'Boeing 737-800', true, '23kg checked + 8kg carry-on', '[]'),
    (tk_id, 'TK1801', ist_id, hav_id, '2026-03-25 08:00:00+00', '2026-03-25 18:00:00+00', 1100.00, 12.00, 280, 52, 'Boeing 777-300ER', false, '30kg checked + 8kg carry-on', '[{"airport":"MIA","duration_minutes":150}]');
END $$;
