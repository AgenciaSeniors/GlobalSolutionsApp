-- ============================================================================
-- 039_rls_grants_cleanup.sql  (already applied to production)
-- Safe DB-verified audit fixes for over-permissive RLS policies / grants:
-- 1. agent_tickets: drop "Public Read Tickets" (anon+auth could read ALL support
--    tickets); the scoped "Agents view own tickets" policy remains.
-- 2. audit_logs: drop the public CHECK(true) INSERT policies + revoke INSERT from
--    anon/authenticated (forged-log spam). Real inserts come from the service-role
--    audit service and SECURITY DEFINER triggers (run as owner, unaffected).
-- 3. insert_encrypted_passenger: revoke EXECUTE from authenticated (SECURITY
--    DEFINER, could inject passengers into other bookings); only the service-role
--    /api/bookings/create route uses it.
-- 4. agent_news: drop "Authenticated Read News" (clients read internal news); the
--    "Agents and admins can view news" policy remains.
-- 5. Revoke default-wide anon grants on vouchers / agent_requests (RLS already
--    denies anon; the grants were dangerous noise).
-- 6. app_settings: expose only public keys (currency, contact, gateway fees);
--    business margins (markup/commission/SLA/loyalty) become admin-only. Admins
--    still read everything via "Admins manage settings" (ALL).
-- All verified on the live DB (privileges + RLS simulations).
-- ============================================================================
drop policy if exists "Public Read Tickets" on public.agent_tickets;

drop policy if exists "Allow all inserts" on public.audit_logs;
drop policy if exists "System can insert logs" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;

revoke execute on function public.insert_encrypted_passenger(uuid, text, text, text, text) from authenticated;
revoke execute on function public.insert_encrypted_passenger(uuid, text, text, date, text, text, date, text) from authenticated;

drop policy if exists "Authenticated Read News" on public.agent_news;

revoke all on public.vouchers from anon;
revoke all on public.agent_requests from anon;

drop policy if exists "Anyone can read settings" on public.app_settings;
create policy "Public reads public settings" on public.app_settings
  for select to public
  using (key = any (array[
    'currency','business_name','business_email','business_phone','business_address',
    'zelle_fee_percentage','zelle_fee_fixed','pix_fee_percentage','pix_fee_fixed',
    'spei_fee_percentage','spei_fee_fixed','square_fee_percentage','square_fee_fixed'
  ]));
