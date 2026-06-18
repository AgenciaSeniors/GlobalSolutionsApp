-- ============================================================================
-- 033_storage_upload_limits.sql  (already applied to production)
-- Phase 8 (contained part): tighten the PII storage buckets.
-- - Bucket-level size/MIME limits on payment-proofs and vouchers (defense in
--   depth for direct storage-API calls).
-- - Remove the broad authenticated INSERT policy on payment-proofs: uploads
--   only ever go through the service-role upload-proof routes.
-- Making these buckets private + serving via signed URLs is deferred to the
-- E2E phase (touches ~7 consumers + voucher emails).
-- ============================================================================
update storage.buckets
   set file_size_limit = 5242880,  -- 5 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
 where id = 'payment-proofs';

update storage.buckets
   set file_size_limit = 10485760, -- 10 MB
       allowed_mime_types = array['application/pdf']
 where id = 'vouchers';

drop policy if exists "Authenticated users can upload payment proofs" on storage.objects;
