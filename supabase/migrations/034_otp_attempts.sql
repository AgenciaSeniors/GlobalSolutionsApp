-- ============================================================================
-- 034_otp_attempts.sql  (already applied to production)
-- Phase 9 — add a failed-attempt counter to auth_otps so /api/auth/verify-otp
-- can lock an OTP after 5 wrong guesses, bounding online brute-force of the
-- 6-digit code (after which a new, rate-limited code must be requested).
-- ============================================================================
alter table public.auth_otps add column if not exists attempts integer not null default 0;
