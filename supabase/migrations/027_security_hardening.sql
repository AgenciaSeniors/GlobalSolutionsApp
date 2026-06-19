-- ============================================================================
-- 027_security_hardening.sql
-- Security hardening pass (already applied to production via Supabase migrations
-- security_hardening_a..e). Idempotent and safe to re-run on a fresh database.
--
-- Closes:
--  * Unauthenticated account takeover via the public `auth_otps` table.
--  * Passport PII RPCs callable by anon/authenticated.
--  * Payment-event forgery (RPC + table policy) and fake flight/airline/airport rows.
--  * Self-awarding of loyalty points via add_loyalty_points.
--  * Over-exposed storage buckets (vouchers / payment-proofs).
--  * Mutable search_path on SECURITY DEFINER functions.
-- ============================================================================

-- ── A. Lock down auth_otps (was RLS-disabled + public grants) ───────────────
alter table public.auth_otps enable row level security;
revoke all on public.auth_otps from anon, authenticated;
revoke all on public.auth_otp_rate_limits from anon, authenticated;

-- ── A2. Revoke EXECUTE from PUBLIC (default grant) on sensitive functions ────
-- Passport PII crypto (only used internally as owner / by service role).
revoke execute on function public.encrypt_passport(text) from public, anon, authenticated;
revoke execute on function public.decrypt_passport(bytea) from public, anon, authenticated;
revoke execute on function public.get_decrypted_passport(uuid, text) from public, anon, authenticated;
grant execute on function public.get_decrypted_passport(uuid, text) to service_role;

-- insert_encrypted_passenger is called by authenticated users (booking flow).
revoke execute on function public.insert_encrypted_passenger(uuid,text,text,date,text,text,date,text) from public, anon;
grant execute on function public.insert_encrypted_passenger(uuid,text,text,date,text,text,date,text) to authenticated, service_role;
revoke execute on function public.insert_encrypted_passenger(uuid,text,text,text,text) from public, anon;
grant execute on function public.insert_encrypted_passenger(uuid,text,text,text,text) to authenticated, service_role;

-- Payment/ledger loggers — service role only (prevents forged payment events).
revoke execute on function public.log_payment_event_once(text,text,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.log_payment_event_once(text,text,text,uuid,text,jsonb) to service_role;
revoke execute on function public.log_stripe_event_once(text,text,uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.log_stripe_event_once(character varying,character varying,uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.log_paypal_event_once(text,text,uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.log_paypal_event_once(character varying,character varying,uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.log_sensitive_access(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.log_sensitive_access(text,text,text,jsonb) to service_role;

-- Internal/admin helpers.
revoke execute on function public.try_lock_search_session(uuid,timestamp with time zone,timestamp with time zone) from public, anon, authenticated;
grant execute on function public.try_lock_search_session(uuid,timestamp with time zone,timestamp with time zone) to service_role;

-- Trigger functions (fired by triggers; do not need direct EXECUTE).
revoke execute on function public.auto_award_booking_points() from public, anon, authenticated;
revoke execute on function public.auto_award_review_points() from public, anon, authenticated;
revoke execute on function public.auto_generate_commission() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.invalidate_flight_search_cache_on_seats_update() from public, anon, authenticated;
revoke execute on function public.log_booking_changes() from public, anon, authenticated;
revoke execute on function public.notify_payment_completed() from public, anon, authenticated;
revoke execute on function public.update_car_rentals_updated_at() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.generate_ticket_code() from public, anon, authenticated;

-- ── E. Lock add_loyalty_points (self-award) — redemption moves server-side ───
revoke execute on function public.add_loyalty_points(uuid,integer,text,character varying,uuid) from public, anon, authenticated;
grant execute on function public.add_loyalty_points(uuid,integer,text,character varying,uuid) to service_role;

-- ── B. Pin search_path on SECURITY DEFINER / our functions ──────────────────
alter function public.add_loyalty_points(uuid,integer,text,character varying,uuid) set search_path = public, pg_temp;
alter function public.auto_award_booking_points() set search_path = public, pg_temp;
alter function public.auto_award_review_points() set search_path = public, pg_temp;
alter function public.auto_generate_commission() set search_path = public, pg_temp;
alter function public.decrypt_passport(bytea) set search_path = public, pg_temp;
alter function public.encrypt_passport(text) set search_path = public, pg_temp;
alter function public.get_decrypted_passport(uuid,text) set search_path = public, pg_temp;
alter function public.insert_encrypted_passenger(uuid,text,text,date,text,text,date,text) set search_path = public, pg_temp;
alter function public.insert_encrypted_passenger(uuid,text,text,text,text) set search_path = public, pg_temp;
alter function public.invalidate_flight_search_cache_on_seats_update() set search_path = public, pg_temp;
alter function public.log_booking_changes() set search_path = public, pg_temp;
alter function public.log_paypal_event_once(character varying,character varying,uuid,text,jsonb) set search_path = public, pg_temp;
alter function public.log_sensitive_access(text,text,text,jsonb) set search_path = public, pg_temp;
alter function public.log_stripe_event_once(character varying,character varying,uuid,text,jsonb) set search_path = public, pg_temp;
alter function public.try_lock_search_session(uuid,timestamp with time zone,timestamp with time zone) set search_path = public, pg_temp;
alter function public.notify_payment_completed() set search_path = public, pg_temp;
alter function public.generate_ticket_code() set search_path = public, pg_temp;
alter function public.update_car_rentals_updated_at() set search_path = public, pg_temp;
alter function public.update_updated_at_column() set search_path = public, pg_temp;

-- ── C. Tighten "always true" write policies ─────────────────────────────────
drop policy if exists "Authenticated users can insert payment events" on public.payment_events;

drop policy if exists "Authenticated can insert flights" on public.flights;
drop policy if exists "Authenticated can update flights" on public.flights;
create policy "Admins can insert flights" on public.flights
  for insert to authenticated with check ((select public.auth_uid_is_admin()));
create policy "Admins can update flights" on public.flights
  for update to authenticated using ((select public.auth_uid_is_admin())) with check ((select public.auth_uid_is_admin()));

drop policy if exists "Authenticated can insert airlines" on public.airlines;
drop policy if exists "Authenticated can update airlines" on public.airlines;
create policy "Admins can insert airlines" on public.airlines
  for insert to authenticated with check ((select public.auth_uid_is_admin()));
create policy "Admins can update airlines" on public.airlines
  for update to authenticated using ((select public.auth_uid_is_admin())) with check ((select public.auth_uid_is_admin()));

drop policy if exists "Authenticated can insert airports" on public.airports;
drop policy if exists "Authenticated can update airports" on public.airports;
create policy "Admins can insert airports" on public.airports
  for insert to authenticated with check ((select public.auth_uid_is_admin()));
create policy "Admins can update airports" on public.airports
  for update to authenticated using ((select public.auth_uid_is_admin())) with check ((select public.auth_uid_is_admin()));

-- ── D. Storage: vouchers (admin only) + payment-proofs (no public listing) ──
drop policy if exists "Acceso total a vouchers" on storage.objects;
drop policy if exists "Permitir todo a administradores 183bix1_0" on storage.objects;
drop policy if exists "Permitir todo a administradores 183bix1_1" on storage.objects;
drop policy if exists "Permitir todo a administradores 183bix1_2" on storage.objects;
drop policy if exists "Admins manage vouchers select" on storage.objects;
drop policy if exists "Admins manage vouchers insert" on storage.objects;
drop policy if exists "Admins manage vouchers update" on storage.objects;
drop policy if exists "Admins manage vouchers delete" on storage.objects;
create policy "Admins manage vouchers select" on storage.objects
  for select to authenticated using (bucket_id = 'vouchers' and (select public.auth_uid_is_admin()));
create policy "Admins manage vouchers insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'vouchers' and (select public.auth_uid_is_admin()));
create policy "Admins manage vouchers update" on storage.objects
  for update to authenticated using (bucket_id = 'vouchers' and (select public.auth_uid_is_admin()))
  with check (bucket_id = 'vouchers' and (select public.auth_uid_is_admin()));
create policy "Admins manage vouchers delete" on storage.objects
  for delete to authenticated using (bucket_id = 'vouchers' and (select public.auth_uid_is_admin()));

drop policy if exists "Anyone can read payment proofs" on storage.objects;
