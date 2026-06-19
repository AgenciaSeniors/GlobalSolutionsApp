-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Flight security + hardening (gaps not covered by main's 027–040)
-- Migration: 041_flight_security_and_hardening.sql
--
-- Idempotent and non-disruptive with current code. Safe to apply before deploy.
-- ============================================

-- 1) Cache-poisoning: remove permissive public policies on flight_search_cache.
--    The app accesses this table only via service_role (bypasses RLS).
DROP POLICY IF EXISTS "public insert flight cache" ON public.flight_search_cache;
DROP POLICY IF EXISTS "public read flight cache"   ON public.flight_search_cache;

-- 2) Defense-in-depth RLS on service-role-only flight infra tables.
ALTER TABLE public.flight_search_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_search_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_rate_limits        ENABLE ROW LEVEL SECURITY;

-- 3) Pin search_path on advisor-flagged functions (main's 027 missed these).
ALTER FUNCTION public.search_airports(text, integer)   SET search_path = public, pg_temp;
ALTER FUNCTION public.immutable_unaccent(text)         SET search_path = public, pg_temp;

-- 4) BUGFIX (also affects main): pgcrypto lives in the `extensions` schema, so the
--    encryption RPCs must include it in search_path. main's 027 sets only
--    `public, pg_temp`, which makes pgp_sym_encrypt fail at runtime → server-side
--    passenger encryption silently breaks. Add `extensions`.
ALTER FUNCTION public.insert_encrypted_passenger(uuid, text, text, date, text, text, date, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.insert_encrypted_passenger(uuid, text, text, text, text)
  SET search_path = public, extensions, pg_temp;

-- 5) profiles: remove world-readable SELECT policy (prod drift) that exposed every
--    user's email/phone/role/fund. Restrictive policies (self/admin/agent) remain.
DROP POLICY IF EXISTS "Perfiles visibles para todos" ON public.profiles;
