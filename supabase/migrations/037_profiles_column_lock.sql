-- ============================================================================
-- 037_profiles_column_lock.sql  (already applied to production)
-- Lock sensitive profiles columns. profiles had table-wide SELECT for
-- anon/authenticated, so any logged-in user could read every user's email,
-- phone, loyalty_points, agent_fund_cents and agent_code. Switch to column-level
-- grants: only safe columns remain readable by the browser; sensitive columns
-- are reachable only via service-role routes (/api/me/profile, /api/admin/agents,
-- /api/admin/booking-contact, /api/admin/promote-agent, payment/pdf routes).
-- Row visibility (RLS) is unchanged.
-- ============================================================================
revoke select on public.profiles from anon, authenticated;
grant select (id, user_id, full_name, avatar_url, role, is_active, created_at, updated_at)
  on public.profiles to anon, authenticated;
