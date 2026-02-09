-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Extended Schema — v2
-- Tables: special_offers, quotation_requests,
--         agent_tickets, loyalty_transactions,
--         chat_conversations, chat_messages
-- ============================================

-- ============================================
-- SPECIAL OFFERS (Visual Engine per §3.2)
-- Admin selects dates, uploads image, urgency tags
-- ============================================
CREATE TABLE IF NOT EXISTS special_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination TEXT NOT NULL,
  destination_img TEXT,                    -- High-quality image URL
  origin_airport_id UUID REFERENCES airports(id),
  destination_airport_id UUID REFERENCES airports(id),
  airline_id UUID REFERENCES airlines(id),
  flight_number VARCHAR(10),
  valid_dates DATE[] NOT NULL,             -- Array of specific dates
  original_price DECIMAL(10,2) NOT NULL,
  offer_price DECIMAL(10,2) NOT NULL,
  markup_percentage DECIMAL(5,2) DEFAULT 10.00,
  tags TEXT[] DEFAULT '{}',                -- e.g. {'exclusive','flash_24h','few_seats'}
  urgency_label TEXT,                      -- "¡Quedan pocos cupos!", "Oferta Flash 24h"
  max_seats INT DEFAULT 20,
  sold_seats INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_special_offers_active ON special_offers(is_active) WHERE is_active = true;
CREATE INDEX idx_special_offers_dates ON special_offers USING GIN(valid_dates);

-- ============================================
-- QUOTATION REQUESTS (§3.3 Fallback)
-- When no results or complex route
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
  trip_type VARCHAR(20) DEFAULT 'roundtrip'
    CHECK (trip_type IN ('oneway', 'roundtrip', 'multicity')),
  flexible_dates BOOLEAN DEFAULT false,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'quoted', 'accepted', 'expired', 'cancelled')),
  quoted_price DECIMAL(10,2),
  quoted_by UUID REFERENCES profiles(id),
  quoted_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotations_status ON quotation_requests(status);

-- ============================================
-- AGENT TICKETS (§2.2 Internal Communication)
-- "Prohibido WhatsApp" — everything logged here
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_code VARCHAR(15) UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  category VARCHAR(30) DEFAULT 'general'
    CHECK (category IN ('general', 'booking_issue', 'payment', 'technical', 'complaint', 'suggestion')),
  priority VARCHAR(10) DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_ticket_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES agent_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  is_internal BOOLEAN DEFAULT false,  -- admin-only notes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_status ON agent_tickets(status);
CREATE INDEX idx_tickets_created_by ON agent_tickets(created_by);
CREATE INDEX idx_ticket_messages_ticket ON agent_ticket_messages(ticket_id);

-- ============================================
-- LOYALTY TRANSACTIONS (§7.2 Points system)
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  points INT NOT NULL,  -- positive = earned, negative = redeemed
  reason TEXT NOT NULL,
  reference_type VARCHAR(20),  -- 'review', 'booking', 'promo', 'redemption'
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_user ON loyalty_transactions(user_id);

-- ============================================
-- CHAT SYSTEM (§7.1 Chatbot IA + Human)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'bot'
    CHECK (status IN ('bot', 'waiting_agent', 'with_agent', 'resolved', 'closed')),
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL
    CHECK (sender_type IN ('user', 'bot', 'agent')),
  sender_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  metadata JSONB,  -- bot confidence score, intent, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_conv_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_conv_status ON chat_conversations(status);
CREATE INDEX idx_chat_messages_conv ON chat_messages(conversation_id);

-- ============================================
-- ADD return_date TO bookings (for review trigger)
-- ============================================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS emitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emitted_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT false;

-- ============================================
-- ADD passport_number to booking_passengers
-- (encrypted via pgp_sym_encrypt)
-- The existing column was BYTEA — keep it.
-- ============================================

-- ============================================
-- FUNCTIONS
-- ============================================

-- Add loyalty points (idempotent)
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_user_id UUID,
  p_points INT,
  p_reason TEXT,
  p_ref_type VARCHAR DEFAULT NULL,
  p_ref_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO loyalty_transactions (user_id, points, reason, reference_type, reference_id)
  VALUES (p_user_id, p_points, p_reason, p_ref_type, p_ref_id);

  UPDATE profiles SET loyalty_points = loyalty_points + p_points
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate ticket code
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_code := 'TK-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_ticket_code
  BEFORE INSERT ON agent_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_code IS NULL OR NEW.ticket_code = '')
  EXECUTE FUNCTION generate_ticket_code();

-- Updated_at triggers for new tables
CREATE TRIGGER update_special_offers_updated_at
  BEFORE UPDATE ON special_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_requests_updated_at
  BEFORE UPDATE ON quotation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_tickets_updated_at
  BEFORE UPDATE ON agent_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (new tables)
-- ============================================

ALTER TABLE special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- SPECIAL OFFERS (public read)
CREATE POLICY "Anyone can view active offers"
  ON special_offers FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage offers"
  ON special_offers FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- QUOTATION REQUESTS
CREATE POLICY "Users view own quotations"
  ON quotation_requests FOR SELECT USING (
    auth.uid() = user_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('agent', 'admin')
  );
CREATE POLICY "Anyone can create quotation"
  ON quotation_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage quotations"
  ON quotation_requests FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('agent', 'admin')
  );

-- AGENT TICKETS
CREATE POLICY "Agents view own tickets"
  ON agent_tickets FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "Agents create tickets"
  ON agent_tickets FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('agent', 'admin')
  );
CREATE POLICY "Admins manage tickets"
  ON agent_tickets FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() = assigned_to
  );

-- AGENT TICKET MESSAGES
CREATE POLICY "Ticket participants view messages"
  ON agent_ticket_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_tickets t
      WHERE t.id = agent_ticket_messages.ticket_id
      AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
           OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );
CREATE POLICY "Ticket participants send messages"
  ON agent_ticket_messages FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_tickets t
      WHERE t.id = agent_ticket_messages.ticket_id
      AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
           OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );

-- LOYALTY
CREATE POLICY "Users view own loyalty"
  ON loyalty_transactions FOR SELECT USING (auth.uid() = user_id);

-- CHAT
CREATE POLICY "Users view own chats"
  ON chat_conversations FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = assigned_agent_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "Users create chats"
  ON chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Chat messages visible to participants"
  ON chat_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR c.assigned_agent_id = auth.uid()
           OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );
CREATE POLICY "Chat participants send messages"
  ON chat_messages FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR c.assigned_agent_id = auth.uid()
           OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    )
  );

-- ============================================
-- SAMPLE SPECIAL OFFERS
-- ============================================
INSERT INTO special_offers (destination, original_price, offer_price, valid_dates, tags, urgency_label, max_seats)
VALUES
  ('Estambul, Turquía', 1250.00, 849.00,
   ARRAY['2026-03-03','2026-03-10','2026-03-17','2026-03-24']::DATE[],
   ARRAY['exclusive','fire'], '¡Quedan pocos cupos!', 15),
  ('Madrid, España', 980.00, 699.00,
   ARRAY['2026-03-05','2026-03-12','2026-03-19','2026-03-26']::DATE[],
   ARRAY['exclusive'], NULL, 20),
  ('Cancún, México', 450.00, 299.00,
   ARRAY['2026-02-14','2026-02-28','2026-03-14']::DATE[],
   ARRAY['flash_24h','fire'], 'Oferta Flash 24h', 30),
  ('Ciudad de Panamá', 620.00, 449.00,
   ARRAY['2026-03-01','2026-03-08','2026-03-15','2026-03-22','2026-03-29']::DATE[],
   ARRAY['exclusive'], NULL, 25);
