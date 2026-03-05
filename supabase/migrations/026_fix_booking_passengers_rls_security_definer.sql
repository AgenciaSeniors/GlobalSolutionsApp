-- =====================================================================
-- Fix: booking_passengers siempre muestra 0 pasajeros
--
-- Problema 1: "Agents view assigned passenger data" usaba
--   auth.jwt() ->> 'role' = 'admin'
--   que NUNCA funciona porque Supabase no incluye el rol de la app en el JWT.
--
-- Problema 2: Las políticas hacen subqueries a `bookings` que pasan por
--   el RLS de `bookings`, creando recursividad que puede devolver vacío.
--
-- Solución: Funciones SECURITY DEFINER que evitan el RLS interno,
--   más una política única y correcta.
-- =====================================================================

-- 1. Función para verificar si el usuario actual es admin (sin pasar por RLS)
CREATE OR REPLACE FUNCTION auth_uid_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  );
$$;

-- 2. Función para verificar si el usuario es propietario del booking (sin pasar por RLS)
CREATE OR REPLACE FUNCTION auth_uid_owns_booking(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = p_booking_id
      AND (b.user_id = auth.uid() OR b.profile_id = auth.uid())
  );
$$;

-- 3. Función para verificar si el usuario es agente asignado al booking (sin pasar por RLS)
CREATE OR REPLACE FUNCTION auth_uid_is_assigned_agent(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = p_booking_id
      AND b.assigned_agent_id = auth.uid()
  );
$$;

-- 4. Eliminar todas las políticas SELECT rotas de booking_passengers
DROP POLICY IF EXISTS "Users view own passenger data" ON public.booking_passengers;
DROP POLICY IF EXISTS "Agents view assigned passenger data" ON public.booking_passengers;

-- 5. Crear una sola política SELECT correcta
CREATE POLICY "booking_passengers_select_v2"
  ON public.booking_passengers FOR SELECT
  USING (
    auth_uid_is_admin()
    OR auth_uid_owns_booking(booking_id)
    OR auth_uid_is_assigned_agent(booking_id)
  );
