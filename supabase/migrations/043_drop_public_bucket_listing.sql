-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Close object listing on public marketing buckets
-- Migration: 043_drop_public_bucket_listing.sql
--
-- Advisor lint 0025 (public_bucket_allows_listing): `car-images` and
-- `experience-images` had a broad public SELECT policy on storage.objects,
-- which lets any client LIST every file in the bucket. Public buckets serve
-- object URLs WITHOUT RLS, so this policy is not needed for `getPublicUrl()`
-- access; it only exposed the file listing. Dropping it keeps public URL
-- serving and admin uploads (separate INSERT policies) intact.
-- `offer-images` already has no public SELECT policy.
-- ============================================

DROP POLICY IF EXISTS "Public read car images" ON storage.objects;
DROP POLICY IF EXISTS "Public read experience images" ON storage.objects;
