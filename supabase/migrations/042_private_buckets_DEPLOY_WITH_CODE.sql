-- ============================================
-- GLOBAL SOLUTIONS TRAVEL
-- Make sensitive storage buckets private
-- Migration: 042_private_buckets_DEPLOY_WITH_CODE.sql
--
-- ⚠️ APPLY TOGETHER WITH THIS PR's CODE DEPLOY, NOT BEFORE.
-- `payment-proofs` (bank screenshots) and `vouchers` (tickets w/ PNR/PII) were
-- PUBLIC. After this they are served only via short-lived signed URLs from the
-- auth-gated endpoint GET /api/files/{voucher|proof}/:bookingId (new in this PR).
-- Applying before that code is live breaks voucher/proof access + emailed links.
-- car-images / experience-images / offer-images stay public (marketing assets).
-- ============================================

UPDATE storage.buckets SET public = false WHERE id IN ('payment-proofs', 'vouchers');
