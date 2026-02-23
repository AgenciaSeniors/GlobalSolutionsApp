-- Migration: 014_fix_booking_passengers_rls
-- Purpose: Fix "0 pasajeros" in the emission panel.
--
-- Root cause: The SELECT policy on booking_passengers only checked
-- bookings.profile_id = auth.uid(), but flight bookings were inserted
-- without profile_id (null), so the admin/emission query returned an
-- empty array even though passengers existed in the table.
--
-- Fix: Drop the broken policy and recreate it to accept EITHER
-- user_id OR profile_id matching auth.uid(), covering all booking modes
-- (flight, offer, multicity) and historical records with profile_id = null.

DROP POLICY IF EXISTS "Users view own passenger data" ON public.booking_passengers;

CREATE POLICY "Users view own passenger data"
  ON public.booking_passengers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_passengers.booking_id
        AND (b.user_id = auth.uid() OR b.profile_id = auth.uid())
    )
  );
