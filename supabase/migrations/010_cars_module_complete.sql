-- ============================================================
-- Migration 010: Complete Cars module (Dev B)
-- Adds missing columns for specs, description, images, location
-- Creates storage bucket for car images
-- Fixes RLS policies for proper admin access
-- ============================================================

-- 1. Add missing columns to car_rentals
ALTER TABLE car_rentals
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS pickup_location text NOT NULL DEFAULT 'La Habana',
  ADD COLUMN IF NOT EXISTS dropoff_location text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS year integer;

-- 2. Expand category check
DO $$
BEGIN
  ALTER TABLE car_rentals DROP CONSTRAINT IF EXISTS car_rentals_category_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE car_rentals ADD CONSTRAINT car_rentals_category_check
  CHECK (category::text = ANY(ARRAY['economy','compact','suv','van','luxury','convertible','midsize']::text[]));

-- 3. Expand transmission check
DO $$
BEGIN
  ALTER TABLE car_rentals DROP CONSTRAINT IF EXISTS car_rentals_transmission_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE car_rentals ADD CONSTRAINT car_rentals_transmission_check
  CHECK (transmission::text = ANY(ARRAY['manual','automatic']::text[]));

-- 4. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_car_rentals_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_car_rentals_updated_at ON car_rentals;
CREATE TRIGGER trg_car_rentals_updated_at
  BEFORE UPDATE ON car_rentals
  FOR EACH ROW EXECUTE FUNCTION update_car_rentals_updated_at();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_car_rentals_active_category
  ON car_rentals (is_active, category);

CREATE INDEX IF NOT EXISTS idx_car_rentals_daily_rate
  ON car_rentals (daily_rate);

-- 6. Fix RLS policies
DROP POLICY IF EXISTS "Admins manage car rentals" ON car_rentals;

CREATE POLICY "Admin full access car_rentals"
  ON car_rentals FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Service role manages car_rentals"
  ON car_rentals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('car-images', 'car-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read car images" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'car-images');

CREATE POLICY "Admin upload car images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'car-images' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admin delete car images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'car-images' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Service role manages car images" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'car-images') WITH CHECK (bucket_id = 'car-images');

-- 8. Update existing seed data with specs
UPDATE car_rentals SET
  description = 'Sedán compacto ideal para la ciudad. Bajo consumo y cómodo para parejas o familias pequeñas.',
  specs = '{"seats":5,"doors":4,"transmission":"automatic","ac":true,"fuel":"gasoline","bags":2,"year":2023,"color":"Blanco","engine":"1.6L"}'::jsonb,
  pickup_location = 'La Habana', currency = 'USD'
WHERE model = 'Accent';

UPDATE car_rentals SET
  description = 'SUV espaciosa con tracción 4x4. Perfecta para explorar Cuba con familia o amigos.',
  specs = '{"seats":5,"doors":4,"transmission":"automatic","ac":true,"fuel":"gasoline","bags":4,"year":2024,"color":"Gris","engine":"2.5L"}'::jsonb,
  pickup_location = 'La Habana', currency = 'USD'
WHERE model = 'RAV4';

UPDATE car_rentals SET
  description = 'Auto compacto económico. Ideal para moverse por la ciudad con bajo presupuesto.',
  specs = '{"seats":4,"doors":4,"transmission":"manual","ac":true,"fuel":"gasoline","bags":1,"year":2022,"color":"Rojo","engine":"1.0L"}'::jsonb,
  pickup_location = 'La Habana', currency = 'USD'
WHERE model = 'Picanto';

UPDATE car_rentals SET
  description = 'Hatchback ágil y económico. Excelente manejo en calles estrechas de La Habana.',
  specs = '{"seats":5,"doors":4,"transmission":"manual","ac":true,"fuel":"gasoline","bags":2,"year":2023,"color":"Azul","engine":"1.2L"}'::jsonb,
  pickup_location = 'La Habana', currency = 'USD'
WHERE model = 'Swift';

UPDATE car_rentals SET
  description = 'SUV premium con asientos de cuero y GPS. La opción más cómoda para recorrer Cuba.',
  specs = '{"seats":5,"doors":4,"transmission":"automatic","ac":true,"fuel":"gasoline","bags":3,"year":2024,"color":"Negro","engine":"2.0L Turbo"}'::jsonb,
  pickup_location = 'La Habana', currency = 'USD'
WHERE model = 'Tucson';
