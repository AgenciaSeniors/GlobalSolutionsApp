-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Complete Database Schema for Supabase
-- Migration: 001_complete_schema.sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'client'
    CHECK (role IN ('client', 'agent', 'admin')),
  avatar_url TEXT,
  loyalty_points INT DEFAULT 0,
  agent_code VARCHAR(10) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airlines
CREATE TABLE airlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iata_code VARCHAR(3) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Airports
CREATE TABLE airports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iata_code VARCHAR(3) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country VARCHAR(3) NOT NULL,
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flights
CREATE TABLE flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airline_id UUID REFERENCES airlines(id) ON DELETE CASCADE,
  flight_number VARCHAR(10) NOT NULL,
  origin_airport_id UUID REFERENCES airports(id),
  destination_airport_id UUID REFERENCES airports(id),
  departure_datetime TIMESTAMPTZ NOT NULL,
  arrival_datetime TIMESTAMPTZ NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  markup_percentage DECIMAL(5,2) DEFAULT 10.00,
  final_price DECIMAL(10,2) GENERATED ALWAYS AS
    (base_price * (1 + markup_percentage / 100)) STORED,
  total_seats INT NOT NULL,
  available_seats INT NOT NULL,
  aircraft_type VARCHAR(50),
  is_exclusive_offer BOOLEAN DEFAULT false,
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_code VARCHAR(10) UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES profiles(id),
  subtotal DECIMAL(10,2) NOT NULL,
  payment_gateway_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method VARCHAR(20),
  payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  booking_status VARCHAR(20) DEFAULT 'pending_emission'
    CHECK (booking_status IN ('pending_emission', 'confirmed', 'cancelled', 'completed')),
  airline_pnr VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Passengers (PII encrypted)
CREATE TABLE booking_passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  nationality VARCHAR(3) NOT NULL,
  passport_number BYTEA NOT NULL,
  passport_expiry_date DATE NOT NULL,
  ticket_number VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car Rentals
CREATE TABLE car_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category VARCHAR(20) NOT NULL,
  transmission VARCHAR(10) NOT NULL,
  passenger_capacity INT NOT NULL,
  luggage_capacity INT NOT NULL,
  daily_rate DECIMAL(10,2) NOT NULL,
  available_units INT DEFAULT 1,
  image_url TEXT,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car Rental Bookings
CREATE TABLE car_rental_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  car_rental_id UUID REFERENCES car_rentals(id) ON DELETE SET NULL,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  pickup_location TEXT NOT NULL,
  return_location TEXT NOT NULL,
  total_days INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews (verified purchases only)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT NOT NULL,
  photo_urls TEXT[],
  status VARCHAR(20) DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  moderated_by UUID REFERENCES profiles(id),
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent News (community wall)
CREATE TABLE agent_news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(20),
  attachment_url TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_agent ON bookings(assigned_agent_id);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_payment ON bookings(payment_status);
CREATE INDEX idx_flights_route ON flights(origin_airport_id, destination_airport_id);
CREATE INDEX idx_flights_dates ON flights(departure_datetime);
CREATE INDEX idx_flights_offers ON flights(is_exclusive_offer) WHERE is_exclusive_offer = true;
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_car_rentals_active ON car_rentals(is_active) WHERE is_active = true;

-- ============================================
-- ENCRYPTION HELPERS
-- ============================================

CREATE OR REPLACE FUNCTION encrypt_passport(passport TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(passport, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_passport(encrypted_data BYTEA)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flights_updated_at
  BEFORE UPDATE ON flights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_car_rental_bookings_updated_at
  BEFORE UPDATE ON car_rental_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Audit log trigger for bookings
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_OP,
    'bookings',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_rental_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Agents can view client profiles"
  ON profiles FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('agent', 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- FLIGHTS (public read)
CREATE POLICY "Anyone can view active flights"
  ON flights FOR SELECT USING (true);

CREATE POLICY "Admins can manage flights"
  ON flights FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- BOOKINGS
CREATE POLICY "Clients view own bookings"
  ON bookings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Agents view assigned bookings"
  ON bookings FOR SELECT USING (
    auth.uid() = assigned_agent_id
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Clients can create bookings"
  ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Agents can update assigned bookings"
  ON bookings FOR UPDATE USING (
    auth.uid() = assigned_agent_id
    OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Only admins can delete bookings"
  ON bookings FOR DELETE USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- BOOKING PASSENGERS
CREATE POLICY "Users view own passenger data"
  ON booking_passengers FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_passengers.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

CREATE POLICY "Agents view assigned passenger data"
  ON booking_passengers FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_passengers.booking_id
      AND (bookings.assigned_agent_id = auth.uid()
           OR auth.jwt() ->> 'role' = 'admin')
    )
  );

-- REVIEWS
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can create reviews for own bookings"
  ON reviews FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = reviews.booking_id
      AND bookings.user_id = auth.uid()
      AND bookings.booking_status = 'completed'
    )
  );

CREATE POLICY "Admins can moderate reviews"
  ON reviews FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- CAR RENTALS (public read)
CREATE POLICY "Anyone can view active car rentals"
  ON car_rentals FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage car rentals"
  ON car_rentals FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- CAR RENTAL BOOKINGS
CREATE POLICY "Users view own car bookings"
  ON car_rental_bookings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create car bookings"
  ON car_rental_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AGENT NEWS
CREATE POLICY "Agents and admins can view news"
  ON agent_news FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('agent', 'admin')
  );

CREATE POLICY "Admins can manage news"
  ON agent_news FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- AUDIT LOGS (read-only for admins)
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- ============================================
-- SEED DATA
-- ============================================

-- Airlines
INSERT INTO airlines (iata_code, name) VALUES
  ('TK', 'Turkish Airlines'),
  ('IB', 'Iberia'),
  ('AF', 'Air France'),
  ('CU', 'Cubana de Aviación'),
  ('CM', 'Copa Airlines'),
  ('VB', 'Viva Aerobus'),
  ('AM', 'Aeroméxico'),
  ('AV', 'Avianca');

-- Airports
INSERT INTO airports (iata_code, name, city, country, timezone) VALUES
  ('HAV', 'José Martí International', 'La Habana', 'CUB', 'America/Havana'),
  ('IST', 'Istanbul Airport', 'Estambul', 'TUR', 'Europe/Istanbul'),
  ('MIA', 'Miami International', 'Miami', 'USA', 'America/New_York'),
  ('MAD', 'Adolfo Suárez Madrid-Barajas', 'Madrid', 'ESP', 'Europe/Madrid'),
  ('CUN', 'Cancún International', 'Cancún', 'MEX', 'America/Cancun'),
  ('PTY', 'Tocumen International', 'Ciudad de Panamá', 'PAN', 'America/Panama'),
  ('BOG', 'El Dorado International', 'Bogotá', 'COL', 'America/Bogota'),
  ('MEX', 'Benito Juárez International', 'Ciudad de México', 'MEX', 'America/Mexico_City');

-- Car Rentals
INSERT INTO car_rentals (brand, model, category, transmission, passenger_capacity, luggage_capacity, daily_rate, features) VALUES
  ('Hyundai', 'Accent', 'economy', 'automatic', 5, 2, 45.00, '["A/C", "Bluetooth", "USB"]'),
  ('Toyota', 'RAV4', 'suv', 'automatic', 5, 4, 75.00, '["A/C", "GPS", "4x4", "Bluetooth"]'),
  ('Kia', 'Picanto', 'compact', 'manual', 4, 1, 35.00, '["A/C", "Radio FM"]'),
  ('Suzuki', 'Swift', 'economy', 'manual', 5, 2, 40.00, '["A/C", "USB", "Bluetooth"]'),
  ('Hyundai', 'Tucson', 'suv', 'automatic', 5, 3, 85.00, '["A/C", "GPS", "Leather", "4x4"]');
